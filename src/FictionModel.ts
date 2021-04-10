import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as yaml from 'yaml';
import * as chokidar from 'chokidar';

const WARNING_SIGN = '\u26a0';
const ERROR_SIGN = '\u26d2';

/*
 * { "title": "Starwars Episode IV", "content": "sw4.md"}
 * { "title": "Starwars Episode IV", 
 *   "content": [
 *     "sw401.md",
 *     "sw402.md", 
 *     ...
 * ]}
 * "filepath.md"
 * [ "path1.md", "path2.md", "path3.md", ...] 
 */

export class FictionModel implements vscode.TreeDataProvider<Object>, vscode.CompletionItemProvider<vscode.CompletionItem> {

  // in order to update TreeView, following should be implemented.
  // see: https://code.visualstudio.com/api/extension-guides/tree-view
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | undefined | void> 
    = new vscode.EventEmitter<vscode.TreeItem | undefined | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | undefined | void> 
    = this._onDidChangeTreeData.event;

  private config: any;
  private document?: DocObject;
  private errorMessage:string|undefined = undefined;

  // hashtag database
  private hashtags: Hashtag[] = [];                   // all hashtags, document order
  private hashtagIds: vscode.CompletionItem[] = [];   // all unique hashtag ids, alphabetical order 
  private hashtagMentioned  = new Id2Hashtags();
  private hashtagQuestioned = new Id2Hashtags();
  private hashtagAnswered   = new Id2Hashtags();

  constructor(public workspaceRoot:string, private configPath: string, private diagCollection: vscode.DiagnosticCollection) {

    this.configPath = path.join(workspaceRoot, this.configPath);
    const watcher = chokidar.watch(this.configPath, {persistent:true});
    watcher.on('change',(file) => {
      console.log(`config file changed.`);
      this.reload();
    });
  }

  async reload() {
    console.log('reload called');
    try {
      let start = new Date().getMilliseconds();
      this.config = yaml.parse(await fs.promises.readFile(this.configPath, 'utf-8'));
      if (!this.config.title || !this.config.contents) {
        throw new Error("Invalid config file");
      }
      this.document = obj2doc(this, this.config.contents);
      this.hashtags = [];
      this.hashtagMentioned.clear();
      this.hashtagQuestioned.clear();
      this.hashtagAnswered.clear();

      let tagIds = new Set<string>();
      DocFile.totalDocNum = 0;
      await Promise.all(allFiles(this.document).map(
          async (file: DocFile)=> {
            let hashtags = await file.scan();
            // console.log(`adding ${hashtags.length} hashtags`);
            this.hashtags.push(...hashtags);
            for(var t of hashtags) {
              tagIds.add(t.id);
              switch(t.kind) {
                case HashtagKind.mentioned:
                  this.hashtagMentioned.add(t.id, t);
                  break;
                case HashtagKind.quenstioned:
                  this.hashtagQuestioned.add(t.id, t);
                  break;
                case HashtagKind.answered:
                  this.hashtagAnswered.add(t.id, t);
                  break;
              }
            }
      }));
      this.hashtagIds = Array.from(tagIds).sort().map((n:string) => new vscode.CompletionItem(n));
      this.checkHashtags();
      this.errorMessage = undefined;
      let duration = new Date().getMilliseconds() - start;
      console.log(`Scanned document in ${duration} ms.`);
    } catch(error) {
      console.error(`Error reading ${this.config}: ${error}`);
      // will be shown in the view panel
      this.errorMessage = `Error scanning document: ${error}`;
    };
    
    this._onDidChangeTreeData.fire(undefined);
  }

  checkHashtags() {
    this.diagCollection.clear();
    let diagMap: Map<string, vscode.Diagnostic[]> = new Map();
    for(const t of this.hashtags) {
      let message:string|undefined;
      let severity:vscode.DiagnosticSeverity|undefined;
      switch(t.kind) {
        case HashtagKind.mentioned:
          break;
        case HashtagKind.quenstioned:
          let questions = this.hashtagQuestioned.get(t.id);
          if (questions && questions.length>1 && questions[0]!==t) {
            message = 'duplicate question';
            severity = vscode.DiagnosticSeverity.Information;
          }
          if (!this.hashtagAnswered.has(t.id)) {
            message = 'not answered';
            severity = vscode.DiagnosticSeverity.Error;
          }
          break;
        case HashtagKind.answered:
          let answers = this.hashtagAnswered.get(t.id);
          if (answers && answers.length>1 && answers[0]!==t) {
            message = 'duplicated answer';
            severity = vscode.DiagnosticSeverity.Warning;
          }
          if (this.hashtagQuestioned.has(t.id)) {
            let questions = this.hashtagQuestioned.get(t.id);
            if (!questions?.[questions.length-1].precede(t)) {
              message = 'answer before question';
              severity = vscode.DiagnosticSeverity.Error;
            }
          } else { // no corresponding question
            message = 'answer without question';
            severity = vscode.DiagnosticSeverity.Error;
          }
      }
      if (message) {
        let diagnostics = diagMap.get(t.docFile.filename);
        if (!diagnostics) { diagnostics = []; }
        diagnostics.push(new vscode.Diagnostic(t.range, message, severity));
        diagMap.set(t.docFile.filename, diagnostics);
        switch(severity) {
          case vscode.DiagnosticSeverity.Warning:
            t.setWarning(message);
            break;
          case vscode.DiagnosticSeverity.Error:
            t.setError(message);
            break;
        }
      }

    }
    diagMap.forEach((diags, docfile) => {
      this.diagCollection.set(vscode.Uri.parse(docfile), diags);
    });
  }

  getTreeItem(element: any): vscode.TreeItem {
    if (typeof element === 'string') {
      return new vscode.TreeItem(element.toString());
    } else {
      return element.getTreeItem();
    }
  }

  getChildren(element?: any): Thenable<any[]> {
    if (this.errorMessage) {
      if (!element) {
        return Promise.resolve([this.errorMessage]);
      } else {
        return Promise.resolve([]);
      }
    }
    if (!this.document) {
      console.log("no workspace or jsonObj");
      return Promise.resolve([]);
    }
    if (!element) {
      // return root
      return Promise.resolve(this.document);
    } 
    return Promise.resolve(element.getChildren());
  }

  /**
   * 
   * @param relative if true, returns path strings relative to workspace
   * @returns paths of all document files 
   */
  getFilePaths(relative:boolean = false): string[] {
    if (!this.document) {
      return [];
    } else {
      return allFiles(this.document).map((file: DocFile) => 
        (relative && file.filename.startsWith(this.workspaceRoot))? 
          file.filename.substring(this.workspaceRoot.length+1) 
          : file.filename);
    }
  }

  // CompletionItemProvider
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, 
    token: vscode.CancellationToken, context: vscode.CompletionContext) {

    // check if it is in comment line 
    if (document.lineAt(position).text.match(/<!--(.*?)-->/)) {
      return this.hashtagIds;
     } else {
       return [];
     }
  }
}

type DocObject = DocSection[] | DocFile[];


function obj2doc(model: FictionModel, obj: any): DocObject {
  if (typeof(obj)==="string") { // single file pattern
    // contents:
    //   file_pattern
    return path2files(model, obj);
  } else if (Array.isArray(obj)) {
    // contents:
    //   - file_pattern_1
    //   - file_pattern_2
    return obj.flatMap((path: string)=>path2files(model, path));
  } else if (typeof(obj)==="object") {
    // chapter_1:
    //   content list
    // chapter_2:
    //   content list
    return Object.entries(obj).map(([title, content])=>new DocSection(model, title, obj2doc(model, content)));
  }
  throw new Error(`Cannot parse ${obj} in config file.`);
}

function path2files(model: FictionModel, filepath: string): DocFile[] {
  return glob.sync(path.join(model.workspaceRoot,filepath))
          .map((filename)=>new DocFile(model, filename));
}

function allFiles(contents: DocObject): DocFile[] {
  if (!contents.length) { 
    return []; 
  } else if (contents[0] instanceof DocFile) { 
    return <DocFile[]> contents; 
  } else {
    return (<DocSection[]>contents).flatMap((section)=>allFiles(section.content));
  }
}

// Container object that holds DocObject. Corresponds to chapters, sections, etc. 
class DocSection {
  constructor(public model:FictionModel, public title:string, public content:DocObject) {
  }

  getTreeItem(): vscode.TreeItem {
    return new vscode.TreeItem(this.title, vscode.TreeItemCollapsibleState.Expanded);
  }

  getChildren(): any[] {
    return this.content??[];
  }
}

// corresponding to one .md file
class DocFile {
  public static totalDocNum: number = 0;
  docNum: number = 0;
  hashtags: Hashtag[] = [];
  private scannedTitle: string|undefined = undefined;

  constructor(public model: FictionModel, public filename: string, public givenTitle?:string) {
    this.docNum = DocFile.totalDocNum;
    DocFile.totalDocNum++;

    const watcher = chokidar.watch(this.filename);
    watcher.on('change',(file) => {
      watcher.close();
      console.log('DocFile calling model reload()');
      this.model.reload();
    });
  }

  getTreeItem(): vscode.TreeItem {
    let errors=0;
    let warnings=0;
    for(var t of this.hashtags) {
      if (t.error) {
        errors++;
      }
      if (t.warning) {
        warnings++;
      }
    }
    var title=this.getTitle();
    if (warnings) {
      title += ' '+WARNING_SIGN+warnings;
    }
    if (errors) {
      title += ' '+ERROR_SIGN+errors;
    }
    let item = new vscode.TreeItem(
      title,
      (this.hashtags.length>0)? 
        vscode.TreeItemCollapsibleState.Collapsed : 
        vscode.TreeItemCollapsibleState.None);
    item.resourceUri = vscode.Uri.file(this.filename);
    item.id = this.filename;
    // item.iconPath = vscode.ThemeIcon.File;
    item.iconPath = new vscode.ThemeIcon("file-text", new vscode.ThemeColor((errors)? "errorForeground":"icon.foreground"));
    item.command = {
      title: "",
      command: 'fictioner.open',
      arguments: [this.filename]
    } as vscode.Command;
    return item;
  }

  getChildren(): any[] {
    return this.hashtags;
  }

  async scan(): Promise<Hashtag[]> {
    const hashtags: Hashtag[] = [];
    const text = await fs.promises.readFile(this.filename, "utf-8");
    let lineno = 0;
    this.scannedTitle = undefined;
    for(const line of text.split(/\r\n|\n\r|\n|\r/g)) { // for each line
      if (line.startsWith('#')) {
        this.scannedTitle = line.split(/\s/)[1];
      } else {
        if (/<!--(.*?)-->/gu.test(line)){
          for(let m of line.matchAll(/#([\p{L}\p{N}_\?!]+)/gu)) {
            hashtags.push(new Hashtag(this, lineno, m.index??0, m[0]));
          }
        }
      }
      lineno++;
    }
    this.hashtags = hashtags;
    // console.log(`scanned ${this.filename}, found ${promises.length} tags`);
    return hashtags;
  }

  getTitle(): string {
    if (this.givenTitle) {
      return this.givenTitle;
    }
    if (this.scannedTitle) {
      return this.scannedTitle;
    }
    return path.basename(this.filename, ".md");
  }

}

class Location {
  constructor(
      public file: DocFile,
      public lineno: number) {
  }
  toString(): string {
      return this.file.filename + ":" + this.lineno;
  }
}

enum HashtagKind {
  mentioned, 
  quenstioned,
  answered,
}

class Id2Hashtags extends Map<string, Array<Hashtag>> {
  add(id: string, tag: Hashtag) {
    if (this.has(id)) {
        this.get(id)?.push(tag);
    } else {
        this.set(id, [tag]);
    }
  }
};

export class Hashtag {
  public kind: HashtagKind;
  public id: string;
  public loc: Location;
  public error: string|undefined=undefined;
  public warning: string|undefined=undefined;

  constructor(public docFile: DocFile, public lineno: number, public column: number, public token: string) {
    this.loc = new Location(docFile, lineno);
    if (token.endsWith('?')) {
      this.kind = HashtagKind.quenstioned;
      this.id = token.substr(1, token.length-2);
    } else if (token.endsWith('!')) {
      this.kind = HashtagKind.answered;
      this.id = token.substr(1, token.length-2);
    } else {
      this.kind = HashtagKind.mentioned;
      this.id = token.substr(1);
    }
  }

  getTreeItem():vscode.TreeItem {
    var title = this.token;

    var tooltip = "";
    if (this.warning) {
      title += '  '+WARNING_SIGN;
      tooltip += this.warning;
    }
    if (this.error) {
      title += '  '+ERROR_SIGN;
      tooltip += this.error;
    }
    let item = new vscode.TreeItem(title);
    item.tooltip = tooltip;
    item.contextValue = 'hashtag';
    item.command = {
      title: "",
      command: 'fictioner.openAndSelect',
      arguments: [this.docFile.filename, 
        new vscode.Range(new vscode.Position(this.loc.lineno, 0), new vscode.Position(this.loc.lineno,0))]
    } as vscode.Command;
    return item;
  }

  getChildren(): any[] {
    return [];
  }

  precede(another: Hashtag) {
    return this.docFile.docNum < another.docFile.docNum ||
        (this.docFile.docNum===another.docFile.docNum &&
         this.lineno < another.lineno);
  }

  setError(message: string) {
    this.error = message;
  }

  setWarning(message: string) {
    this.warning = message;
  }

  get range():vscode.Range {
    return new vscode.Range(this.lineno, this.column, this.lineno, this.column+this.token.length);
  }
}

