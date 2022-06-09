import * as vscode from 'vscode';
import { Uri } from 'vscode';
import * as path from 'path';
import * as glob from 'glob';
import * as yaml from 'yaml';
import * as chokidar from 'chokidar';
import { readTextFile } from './Util';
import { homeDir, configFile, analyticsView, EXT_NAME } from './extension';

export class FictionModel implements
  vscode.TreeDataProvider<Object>,
  vscode.CompletionItemProvider<vscode.CompletionItem> {

  // in order to update TreeView, followings should be implemented.
  // see: https://code.visualstudio.com/api/extension-guides/tree-view
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private watcher: chokidar.FSWatcher | undefined = undefined; 

  public config: any;
  private document?: DocObject;
  private errorMessage: string | undefined = undefined;

  // hashtag database
  private hashtags: Hashtag[] = [];                   // all hashtags, document order
  private hashtagIds: vscode.CompletionItem[] = [];   // all unique hashtag ids, alphabetical order 
  public hashtagDB = new TagDB();
  private diagnostics = vscode.languages.createDiagnosticCollection(EXT_NAME);
  totalChars = 0;

  constructor() {
  }

  dispose() {
    this.diagnostics.dispose();
  }

  async scan() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    try {
      const start = new Date().getMilliseconds();
      this.config = yaml.parse(await readTextFile(configFile()!));

      if (!this.config.title || !this.config.contents) {
        throw new Error("Invalid config file");
      }
      this.document = obj2doc(this, this.config.contents);
      this.hashtags = [];
      this.hashtagDB.clear();
      const tagIds = new Set<string>();
      let offset = 0;
      this.totalChars = 0;
      const _allFiles = allFiles(this.document);
      console.log(`Scanning ${_allFiles.length} files`);
      for (const file of _allFiles) {
        file.offset = offset;
        const [hashtags, numChars] = await file.scan();
        offset += numChars;
        this.hashtags.push(...hashtags);
        for (const t of hashtags) {
          tagIds.add(t.id);
          this.hashtagDB.insert(t);
        }
      }
      this.hashtagIds = Array.from(tagIds).sort().map((n: string) => new vscode.CompletionItem(n));
      this.checkHashtags();
      this.errorMessage = undefined;
      this.totalChars = offset;
      console.log(`scan took ${new Date().getMilliseconds() - start} msec`);
      analyticsView.reload(true);
    } catch (error) {
      console.error(`Error reading ${this.config}: ${error}`);
      // will be shown in the view panel
      this.errorMessage = `Error scanning document: ${error}`;
    };

    const watchFiles = [configFile()!.fsPath, ...this.getFilePaths(false)];
    this.watcher = chokidar.watch(watchFiles);
    console.log(`watching ${watchFiles.length} files.`);
    this.watcher.on('change', async (file: string) => {
      await this.watcher?.close();
      this.scan();
    });
    this._onDidChangeTreeData.fire(undefined);
  }

  checkHashtags() {
    this.diagnostics.clear();
    const diagMap: Map<string, vscode.Diagnostic[]> = new Map();
    for (const t of this.hashtags) {
      let message: string | undefined;
      let severity: vscode.DiagnosticSeverity | undefined;
      switch (t.kind) {
        case HashtagKind.mentioned:
          break;
        case HashtagKind.quenstioned:
          {
            if (this.hashtagDB.ifExistBefore(t.kind, t.id, t)) {
              message = 'duplicate question';
              severity = vscode.DiagnosticSeverity.Information;
            }
            if (!this.hashtagDB.ifExist(HashtagKind.answered, t.id)) {
              message = 'not answered';
              severity = vscode.DiagnosticSeverity.Error;
            }
          }
          break;
        case HashtagKind.answered:
          {
            if (this.hashtagDB.ifExistBefore(HashtagKind.answered, t.id, t)) {
              message = 'duplicate answer';
              severity = vscode.DiagnosticSeverity.Warning;
            }
            if (!this.hashtagDB.ifExistBefore(HashtagKind.quenstioned, t.id, t)) {
              message = 'no question before answer';
              severity = vscode.DiagnosticSeverity.Error;
            }
          }
          break;
      }
      if (message) {
        const diagnostics = diagMap.get(t.docFile.filename) ?? [];
        diagnostics.push(new vscode.Diagnostic(t.range, message, severity));
        diagMap.set(t.docFile.filename, diagnostics);
        switch (severity) {
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
      this.diagnostics.set(Uri.file(docfile), diags);
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
      console.log("no workspace or config file");
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
  getFilePaths(relative: boolean = false): string[] {
    if (!this.document) {
      return [];
    } else {
      const homePath = homeDir()!.fsPath;
      return allFiles(this.document).map((file: DocFile) =>
        (relative && file.filename.startsWith(homePath)) ?
          file.filename.substring(homePath.length + 1)
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

class TagDB {
  // indexes
  private db: Map<HashtagKind, Map<string, Hashtag[]>>;

  constructor() {
    this.db = new Map();
  }

  clear() {
    this.db.clear();
  }

  // index functions
  insert(tag: Hashtag) {
    if (!this.db.get(tag.kind)) {
      this.db.set(tag.kind, new Map());
    }
    if (!this.db.get(tag.kind)!.get(tag.id)) {
      this.db.get(tag.kind)!.set(tag.id, []);
    }
    this.db.get(tag.kind)?.get(tag.id)?.push(tag);
  }

  query(id: string, kind?: HashtagKind): Hashtag[] | undefined {
    if (kind) {
      return this.db.get(kind)?.get(id);
    } else {
      // match regardless of kind
      let matches: Hashtag[] = [];
      for (let tags of this.db.values()) {
        if (tags.has(id)) {
          matches.push(...tags.get(id)!);
        }
      }
      return (matches.length > 0) ? matches : undefined;
    }
  }

  ifExist(kind: HashtagKind, id: string): boolean {
    let tags = this.query(id, kind);
    return (tags !== undefined && tags.length > 0);
  }

  ifExistBefore(kind: HashtagKind, id: string, t: Hashtag): boolean {
    let tags = this.query(id, kind);
    if (tags === undefined) {
      return false;
    }
    for (let t1 of tags) {
      if (t1.precede(t)) {
        return true;
      }
    }
    return false;
  }
}


type DocObject = (DocSection | DocFile)[];


function obj2doc(model: FictionModel, obj: any): DocObject {
  if (typeof (obj) === "string") { // single file pattern
    // contents:
    //   file_pattern
    return path2files(model, obj);
  } else if (Array.isArray(obj)) {
    // contents:
    //   - file_pattern_1
    //   - file_pattern_2
    const children: DocObject = [];
    for (let c of obj) {
      if (typeof (c) === "string") {
        children.push(...path2files(model, c));
      } else {
        children.push(...obj2doc(model, c));
      }
    }
    return children;
    // return obj.flatMap((path: string)=>path2files(model, path));
  } else if (typeof (obj) === "object") {
    // chapter_1:
    //   content list
    // chapter_2:
    //   content list
    return Object.entries(obj).map(
      ([title, content]) =>
        new DocSection(model, title, obj2doc(model, content))
    );
  }
  throw new Error(`Cannot parse ${obj} in config file.`);
}

//
// given relative file path glob pattern, returns list of DocFiles
//
function path2files(model: FictionModel, filepath: string): DocFile[] {
  return glob.sync(path.join(homeDir()!.fsPath, filepath))
    .map((filename) => new DocFile(model, filename));
}

function allFiles(contents: DocObject): DocFile[] {
  if (!contents.length) {
    return [];
  } else {
    const files: DocFile[] = [];
    for (let obj of contents) {
      if (obj instanceof DocFile) {
        files.push(obj);
      } else {
        files.push(...allFiles(obj.content));
      }
    }
    return files;
  }
}

// Container object that holds DocObject. Corresponds to chapters, sections, etc. 
class DocSection {
  constructor(public model: FictionModel, public title: string, public content: DocObject) {
  }

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.title, vscode.TreeItemCollapsibleState.Expanded);
    // item.iconPath = new vscode.ThemeIcon("folder");
    item.iconPath = vscode.ThemeIcon.Folder;
    return item;
  }

  getChildren(): any[] {
    return this.content ?? [];
  }
}

// corresponding to one .md file
class DocFile {
  public static totalDocNum: number = 0;
  docNum: number = 0;
  hashtags: Hashtag[] = [];
  offset: number = 0;
  private scannedTitle: string | undefined = undefined;

  constructor(public model: FictionModel, public filename: string, public givenTitle?: string) {
    this.docNum = DocFile.totalDocNum;
    this.filename = path.normalize(this.filename);
    DocFile.totalDocNum++;
  }

  getTreeItem(): vscode.TreeItem {
    let errors = 0;
    let warnings = 0;
    for (var t of this.hashtags) {
      if (t.error) {
        errors++;
      }
      if (t.warning) {
        warnings++;
      }
    }
    let title = this.getTitle();
    let titleOrigLen = title.length;
    if (warnings) {
      title += ` W${warnings}`;
    }
    if (errors) {
      title += ` E${errors}`;
    }
    let label = (title === this.getTitle()) ?
      title :
      <vscode.TreeItemLabel>{ label: title, highlights: [[titleOrigLen + 1, title.length]] };
    let item = new vscode.TreeItem(
      label,
      (this.hashtags.length > 0) ?
        vscode.TreeItemCollapsibleState.Collapsed :
        vscode.TreeItemCollapsibleState.None);
    item.resourceUri = Uri.file(this.filename);
    item.id = this.filename;
    item.iconPath = vscode.ThemeIcon.File;
    item.command = {
      title: "",
      command: EXT_NAME + '.open',
      arguments: [this.filename]
    } as vscode.Command;
    return item;
  }

  getChildren(): any[] {
    return this.hashtags;
  }

  async scan(): Promise<[Hashtag[], number]> {
    const hashtags: Hashtag[] = [];
    const text = await readTextFile(this.filename);
    const lines = text.split(/\r\n|\n\r|\n|\r/g);
    // const lines = text.split("\n");
    let totalChars = 0;
    this.scannedTitle = undefined;
    for (let lineno = 0; lineno < lines.length; lineno++) {
      const line = lines[lineno];
      let m = /^#+\s+(.*)$/gu.exec(line); // title line
      if (m) {
        this.scannedTitle = m[1];
        totalChars += m[1].length +1;
      } else {
        if (/<!--(.*?)-->/gu.test(line)) { // comment line
          let matches = Array.from(line.matchAll(/#[\p{L}\p{N}_\-\.\?!]+/gu));
          if (matches.length > 0) {
            let text = "";
            for (let j = lineno + 1; j < lines.length && text.length < 200; j++) {
              if (text.trim().length > 2 && lines[j].trim().length === 0) {
                break; // break when line is empty and gathered text is not
              }
              text += lines[j] + "\n";
            }
            for (let tag of matches) {
              hashtags.push(new Hashtag(this, lineno, tag.index ?? 0, tag[0], text, line, this.offset+totalChars));
            }
          }
        } else {
          // normal text line
          totalChars += line.trim().length+1;
        }
      }
    }
    this.hashtags = hashtags;
    return [hashtags, totalChars];
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
  public error?: string;
  public warning?: string;

  constructor(
    public docFile: DocFile,
    public lineno: number,
    public column: number,
    public token: string,
    public contextText: string,
    public tagLine: string,
    public globalOffset: number) {
    this.loc = new Location(docFile, lineno);
    if (token.endsWith('?')) {
      this.kind = HashtagKind.quenstioned;
      this.id = token.substr(1, token.length - 2);
    } else if (token.endsWith('!')) {
      this.kind = HashtagKind.answered;
      this.id = token.substr(1, token.length - 2);
    } else {
      this.kind = HashtagKind.mentioned;
      this.id = token.substr(1);
    }
  }

  getTreeItem(): vscode.TreeItem {
    var title = this.token;

    var tooltip = "";

    const item = new vscode.TreeItem(title);

    if (this.warning) {
      // title += '  '+WARNING_SIGN;
      item.iconPath = new vscode.ThemeIcon('warning',
        new vscode.ThemeColor('list.warningForeground'));
      tooltip += this.warning;
    }
    if (this.error) {
      // title += '  '+ERROR_SIGN;
      item.iconPath = new vscode.ThemeIcon('error',
        new vscode.ThemeColor('list.errorForeground'));
      tooltip += this.error;
    }
    item.tooltip = tooltip;
    item.contextValue = 'hashtag';
    item.command = {
      title: "",
      command: EXT_NAME + '.openAndSelect',
      arguments: [this.docFile.filename, this.loc.lineno]
    } as vscode.Command;
    return item;
  }

  getChildren(): any[] {
    return [];
  }

  precede(another: Hashtag) {
    // return this.docFile.docNum < another.docFile.docNum ||
    //   (this.docFile.docNum === another.docFile.docNum &&
    //     this.lineno < another.lineno);
    return this.compare(another) < 0;
  }

  sameLocation(another: Hashtag) {
    return this.docFile === another.docFile && this.lineno === another.lineno;
  }

  compare(another: Hashtag): number {
    if (this.docFile.docNum < another.docFile.docNum) {
      return -1;
    } else if (this.docFile.docNum > another.docFile.docNum) {
      return 1;
    } else {
      if (this.lineno < another.lineno) {
        return -1;
      } else if (this.lineno > another.lineno) {
        return 1;
      } else {
        return 0;
      }
    }
  }

  setError(message: string) {
    this.error = message;
  }

  setWarning(message: string) {
    this.warning = message;
  }

  get range(): vscode.Range {
    return new vscode.Range(this.lineno, this.column, this.lineno, this.column + this.token.length);
  }
}

