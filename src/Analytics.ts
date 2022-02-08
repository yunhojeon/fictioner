import * as vscode from 'vscode';
import * as path from 'path';
import { resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';
import { FictionModel, Hashtag } from './FictionModel';
import { openAndSelectLine } from './Util';
import { homeDir } from './extension';
import { WebpackOptionsValidationError } from 'webpack';
import { setFlagsFromString } from 'v8';

const ANALVIEW_KEY = 'analyticsView';

export class AnalyticsView {

    panel: vscode.WebviewPanel | undefined;
    private disposable: vscode.Disposable;
    private prevLocation: { doc: vscode.TextDocument, pos: vscode.Position } | undefined;
    private prevHashtagLineNum: number | undefined;
    private relatedTags: Hashtag[]=[];
    
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;
    
    constructor(private context: vscode.ExtensionContext, public model: FictionModel) {

        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);
        vscode.window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        this.disposable = vscode.Disposable.from(...subscriptions);

        if (this.context.workspaceState.get(ANALVIEW_KEY)) {
            this.show();
        }
    }
    
    public dispose() {
        this.disposable.dispose();
    }

    show() {
        if (!this.panel) {
            this.prevLocation = undefined;
            this.panel = vscode.window.createWebviewPanel(
                'fictioner', 'Fictioner Analytics',
                { viewColumn: vscode.ViewColumn.Beside, 
                  preserveFocus: true },
                { enableScripts: true }
            );
            this.context.workspaceState.update(ANALVIEW_KEY, true);
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.context.workspaceState.update(ANALVIEW_KEY, false);
            });
            this.panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'openDoc':
                            const uri = vscode.Uri.joinPath( homeDir()!, message.filename);
                            openAndSelectLine(uri, message.lineno);
                            return;
                    }
                }
            );
            this.reload();
        }
    }

    // set forced to true when the result should not be cached, e.g. when document is reloaded
    reload(forced = false) {

        // This functions should be optimized as it is called on every cursor move
        // first, check if the analytics panel is open and the current document is a markdown text
        let uri = vscode.window.activeTextEditor?.document.uri;
        if (!(this.panel && uri && uri.scheme === "file" && uri.fsPath.endsWith(".md"))) {
            return;
        }

        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            return;
        }

        const currentDoc = editor.document;
        const currentPos = editor.selection.start;

        // check if line number has changed, ignoring column, if it isn't hashtag line
        if (!forced &&
            this.prevLocation?.doc===currentDoc && 
            this.prevLocation?.pos.line===currentPos?.line &&
            this.prevHashtagLineNum!==currentPos?.line) {
                return;
        }
        
        // search for hashtag line above
        let hashtagLineNum = -1;
        let hashtagLine: String | undefined;
        console.log("reload pos = ${currentPos}");
        for (let i = currentPos.line; i>=0 && currentPos.line-i<10; i--) {
            let line = editor.document.lineAt(i).text;
            if (/<!--(.*?)-->/gu.test(line)) {
                hashtagLineNum = i;
                hashtagLine = line;
                break;
            }
        }
        
        if (!forced &&
            hashtagLineNum===this.prevHashtagLineNum &&
            hashtagLineNum!==currentPos?.line &&
            this.prevLocation?.pos.line!==this.prevHashtagLineNum) {
                // cursor has moved to another line, but corresponding hashtag line is the same
                return;
        }

        this.prevHashtagLineNum = hashtagLineNum;
        this.prevLocation = { doc: currentDoc, pos: currentPos };
            
        let relatedTags: Hashtag[]=[];
        if (hashtagLine) {
            for (let m of hashtagLine.matchAll(/#([\p{L}\p{N}_\-\.]+)/gu)) {
                // if cursor is on the hashtag line, select only the hashtag at the cursor
                // if not, select all hashtags
                if (hashtagLineNum!==currentPos.line ||
                    currentPos.character>=m.index! && currentPos.character<m.index!+m[0].length) {
                    let related = this.model.hashtagDB.query(m[1]);
                    if (related) {
                        relatedTags.push(...related);
                    }
                }
            }
        }

        // sort by document order, remove tags at the same location
        this.relatedTags = relatedTags
            .sort((t1, t2)=>t1.compare(t2))
            .filter((t, index, tags)=> index===0 || !t.sameLocation(tags[index-1]));

        const fs = vscode.workspace.fs;
        const html = fs.readFile(vscode.Uri.file(
            path.join(this.context.extensionPath, 'analytics', 'index.html')
        )).then((data: Uint8Array) => {
            // this.panel!.webview.html = data.toString().replace("${content}", this.generateContent()??"");
            this.panel!.webview.html = data.toString();
            this.panel!.webview.postMessage(this.generateContent(hashtagLineNum));
        });
    }
    
    private onEvent() {
        this.reload();
    }

    generateContent(hashtagLineNum:number): any {
        console.log("generateContent");
        const totalChars = this.model.totalChars;
        const editor = vscode.window.activeTextEditor;
        return this.relatedTags.map( (t) => {
            if (t.docFile.filename===editor?.document.fileName && t.lineno===hashtagLineNum) {
                return { currentLocation: true, position: t.globalOffset/totalChars };
            } else {
                return {
                    currentLocation: false,
                    filename: vscode.workspace.asRelativePath(t.docFile.filename),
                    lineno: t.lineno,
                    contextText: t.contextText,
                    position: t.globalOffset/totalChars,
                    tags: t.tagLine.match(/<!--(.*?)-->/)?.[1] // whatever is inside comment
                };
            }
        });
    }
}
