import * as vscode from 'vscode';
import * as path from 'path';
import { resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';
import { FictionModel, Hashtag } from './FictionModel';
import { openAndSelectLine } from './Util';
import { homeDir } from './extension';
import { WebpackOptionsValidationError } from 'webpack';

const ANALVIEW_KEY = 'analyticsView';

export class AnalyticsView {

    panel: vscode.WebviewPanel | undefined;
    private disposable: vscode.Disposable;
    private onHashtagLine = false;

    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;
    lastLocation: { doc: vscode.TextDocument, pos: vscode.Position } | undefined;

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

    reload(forced: boolean = false) {
        if (!this.panel) {
            return;
        }
        const currentDoc = vscode.window.activeTextEditor?.document;
        const currentPos = vscode.window.activeTextEditor?.selection.start;
        // XXX code is too complicated
        if (forced || 
            this.lastLocation===undefined || 
            this.lastLocation.doc!==currentDoc ||
            (!this.onHashtagLine && this.lastLocation.pos.line!==currentPos?.line) ||
            (this.onHashtagLine && this.lastLocation.pos!==currentPos!)) {
                this.lastLocation = { doc: currentDoc!, pos: currentPos! };
                // XXX should cache
                const fs = vscode.workspace.fs;
                const html = fs.readFile(vscode.Uri.file(
                    path.join(this.context.extensionPath, 'analytics', 'index.html')
            )).then((data: Uint8Array) => {
                // this.panel!.webview.html = data.toString().replace("${content}", this.generateContent()??"");
                this.panel!.webview.html = data.toString();
                this.panel!.webview.postMessage(this.generateContent());
            });
        }
    }
    
    private onEvent() {
        let uri = vscode.window.activeTextEditor?.document.uri;
        // TODO: check if it is one of the content files
        if (this.panel && uri && uri.scheme === "file" && uri.fsPath.endsWith(".md")) {
            this.reload();
        }
    }

    generateContent(): any {
        // console.log("generateContent");
        let editor = vscode.window.activeTextEditor;
        if (editor===undefined) {
            return undefined;
        }
        let pos = editor.selection.start;
        
        // look for hashtags above
        let relatedTags: Hashtag[]=[];
        let thisTagLine = -1;
        this.onHashtagLine=false;
        for (let i = 0; i < 10 && pos.line - i >= 0; i++) {
            thisTagLine = pos.line-i;
            let line = editor.document.lineAt(thisTagLine).text;
            if (/<!--(.*?)-->/gu.test(line)) {
                this.onHashtagLine = i===0;
                for (let m of line.matchAll(/#([\p{L}\p{N}_\-\.]+)/gu)) {
                    if (i>0 || pos.character>=m.index! && pos.character<m.index!+m[0].length) {
                        let related = this.model.hashtagDB.query(m[1]);
                        if (related) {
                            relatedTags.push(...related);
                        }
                    }
                }
                break; 
            }
        }

        // sort by document order, remove tags at the same location
        relatedTags = relatedTags
                .sort((t1, t2)=>t1.compare(t2))
                .filter((t, index, tags)=> index===0 || !t.sameLocation(tags[index-1]));

        const totalChars = this.model.totalChars;

        return relatedTags.map( (t) => {
            if (t.docFile.filename===editor?.document.fileName && t.lineno===thisTagLine) {
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
