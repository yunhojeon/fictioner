import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as markdownIt from 'markdown-it';
import * as glob from 'glob';
import { assert } from 'console';
import { promises } from 'dns';

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
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> 
    = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> 
    = this._onDidChangeTreeData.event;
  private jsonPath: string;
  private document?: SectionOrFiles;
  private errorMessage:string|null = null;

  // hashtag database
  private hashtags: HashTag[] = [];
  private hashtagIds: vscode.CompletionItem[] = [];
  private hashtagMentioned  = new Id2Hashtags();
  private hashtagQuestioned = new Id2Hashtags();
  private hashtagAnswered   = new Id2Hashtags();

  constructor(public workspaceRoot:string, private fictionJson: string) {
    // console.log("FictionDataProvider constructed", workspaceRoot);
    // this.fictionJson = path.join(this.workspaceRoot, FICTION_JSON);
    this.jsonPath = path.join(workspaceRoot, fictionJson);
    fs.watch(this.jsonPath,() => {
      this.reload();
    });
  }

  async reload(): Promise<void> {
    try {
      let start = new Date().getMilliseconds();
      let jsonObj = JSON.parse(await fs.promises.readFile(this.jsonPath, 'utf-8'));
      this.document = DocSection.fromJsonObject(this, jsonObj);
      this.hashtags = [];
      this.hashtagMentioned.clear();
      this.hashtagQuestioned.clear();
      this.hashtagAnswered.clear();

      let tagIds = new Set<string>();
      DocFile.totalDocNum = 0;
      await this.traverseFiles(this.document, async (file: DocFile)=> {
        let hashtags = await file.scan();
        // console.error(`adding ${hashtags.length} hashtags`);
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
      });
      this.hashtagIds = Array.from(tagIds).sort().map((n:string) => new vscode.CompletionItem(n));
      // console.log(`${this.hashtags.length} hashtags found.`);
      // console.log(`${this.fictionJson} successfully read`);
      this.checkHashtags();
      let duration = new Date().getMilliseconds() - start;
      console.info(`Scanned document in ${duration} ms.`);
      this.errorMessage = null;

    } catch(error) {
      // TODO show error in the view panel
      console.error(`Error reading ${this.fictionJson}: ${error}`);
      this.errorMessage = `Error scanning document: ${error.toString()}`;
    };
    
    this._onDidChangeTreeData.fire(undefined);
  }

  checkHashtags() {
    for(const t of this.hashtags) {
      switch(t.kind) {
        case HashtagKind.mentioned:
          break;
        case HashtagKind.quenstioned:
          let questions = this.hashtagQuestioned.get(t.id);
          if (questions && questions.length>1 && questions[0]!==t) {
            t.setWarning('duplicate question');
          }
          if (!this.hashtagAnswered.has(t.id)) {
            t.setError('not answered');
          }
          break;
        case HashtagKind.answered:
          if (t!==this.hashtagAnswered.get(t.id)?.[0]) {
            t.setWarning('duplication answer');
          }
          if (this.hashtagQuestioned.has(t.id)) {
            let answers = this.hashtagAnswered.get(t.id);
            if (answers![answers!.length-1].precede(t)) {
              t.setError('answer before question');
            }
          } else {
            t.setError('answer without question');
          }
      }
    }
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
      return Promise.resolve([this.document]);
    } 
    return Promise.resolve(element.getChildren());
  }

  getFilePaths(relative:boolean = false): string[] {
    if (!this.document) {
      return [];
    }
    // depth-first traverse
    let files: string[] = [];
    // this.collectFiles(this.document, files, relative);
    this.traverseFiles(this.document, async (file: DocFile)=> {
      let filename = (relative && file.filename.startsWith(this.workspaceRoot))? 
                     file.filename.substring(this.workspaceRoot.length+1) : file.filename;
      files.push(`"${filename}"`);
    });
    return files;
  }

  // synchronously traverse
  private async traverseFiles(elem: SectionOrFiles, func: (file: DocFile)=>Promise<void>) {
    if (elem instanceof DocFile) {
      await func(elem);
    } else {
      for(var child of (<DocSection>elem).content) {
        await this.traverseFiles(child, func);
      }
    }
  }

  // CompletionItemProvider
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, 
    token: vscode.CancellationToken, context: vscode.CompletionContext) {

    // check if it is in comment 
    const m = document.lineAt(position).text.match(/<!--(.*?)-->/);
    if (m) {
        console.log(`trigger context = ${context.triggerCharacter}, ${context.triggerKind}`);
        // return [new vscode.CompletionItem("sample_hash")];
        return this.hashtagIds;
    } else {
        return [];
    }
}
}

type SectionOrFiles = DocSection | DocFile[];


// fiction.json 내에 하나의 node로 표현되는 section, chapter or the whole book
class DocSection {

  constructor(public model:FictionModel, public title:string, public content:SectionOrFiles[]) {
  }

  getTreeItem(): vscode.TreeItem {
    return new vscode.TreeItem(this.title, vscode.TreeItemCollapsibleState.Expanded);
  }

  getChildren(): any[] {
    return (this.content)? this.content:[];
  }

  static fromJsonObject(model: FictionModel, obj: any): SectionOrFiles {
    if (typeof (obj) === "string") {
      // string literal without title, inside array
      return this.path2files(model, obj);
    }

    if ("content" in obj) {

      if (typeof (obj.content) === "string") { // single file with explicit title 
        let files = this.path2files(model, obj.content, obj.title);
        if (files.length>1) {
          throw Error("cannot use wildcard here!");
        }
        return files;
      }

      if (Array.isArray(obj.content)) {
        var children: SectionOrFiles[] = [];
        for (var c of obj.content) {
          let child = this.fromJsonObject(model, c);
          if (Array.isArray(child)) {
            children = children.concat(child); // DocFile[] 이면 새로운 노드를 만들지 않고 DocFile을 펼쳐서 add한다.
          } else { // DocFile[] 
            children.push(child);
          }
        }
        return new DocSection(model, obj.title, children);
      }
      return new DocSection(model, obj.title, [this.fromJsonObject(model, obj.content)]);
    }
    throw new Error(`Invalid JSON ${obj}`);
  }

  static path2files(model: FictionModel, filepath: string, title?:string): DocFile[] {
    let files: DocFile[] = [];
    for (var filename of glob.sync(path.join(model.workspaceRoot,filepath))) {
      // remove workspaceRoot from path
      files.push(new DocFile(model, filename, title));
    }
    return files;
  }

}

// corresponding to one .md file
class DocFile {
  public static totalDocNum: number = 0;
  docNum: number = 0;
  hashtags: HashTag[] = [];
  watcher: fs.FSWatcher;
  private scannedTitle: string|null = null;

  constructor(public model: FictionModel, public filename: string, public givenTitle?:string) {
    this.docNum = DocFile.totalDocNum;
    DocFile.totalDocNum++;
    this.watcher = fs.watch(this.filename,() => {
      this.watcher.close(); // unregister file watcher
      this.model.reload();
    });
  }

  getTreeItem(): vscode.TreeItem {
    var errors=0;
    var warnings=0;
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

  async scan(): Promise<HashTag[]> {
    let hashtags: HashTag[] = [];
    let text = await fs.promises.readFile(this.filename, "utf-8");
    let lineno = 0;
    this.scannedTitle = null;
    for(const line of text.split(/\r\n|\n\r|\n|\r/g)) { // for each line
      if (line.startsWith('#')) {
        this.scannedTitle = line.split(/\s/)[1];
      } else {
        // look for #hashtags in comments
        let m = line.match(/<!--(.*?)-->/gmu);            // comment should be in single line
        if (m) {
          for(let token of m[0].match(/#([\p{L}\p{N}_\?!]+)/gmu) ?? []) {
            // let loc = new Location(this, lineno);
            // let tag = token.substr(1);
            // let kind = (tag.endsWith('?'))? HashtagKind.quenstioned : (tag.endsWith('!'))? HashtagKind.answered : HashtagKind.mentioned;
            // hashtags.push(new HashTag(this, loc, tag, kind));
            hashtags.push(new HashTag(this, lineno, token));
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

type HashtagId = string;

enum HashtagKind {
  mentioned, 
  quenstioned,
  answered,
}

class Id2Hashtags extends Map<string, Array<HashTag>> {
  add(id: string, tag: HashTag) {
    if (this.has(id)) {
        this.get(id)?.push(tag);
    } else {
        this.set(id, [tag]);
    }
  }
};

class HashTag {
  public kind: HashtagKind;
  public id: string;
  public loc: Location;
  public error: string|null=null;
  public warning: string|null=null;

  constructor(public docFile: DocFile, public lineno: number, public token: string) {
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
      title += ' '+WARNING_SIGN;
      tooltip += this.warning;
    }
    if (this.error) {
      title += ' '+ERROR_SIGN;
      tooltip += this.error;
    }
    let item = new vscode.TreeItem(title);
    item.tooltip = tooltip;
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

  precede(another: HashTag) {
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
}

