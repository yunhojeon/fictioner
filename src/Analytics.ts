import * as vscode from 'vscode';
import * as path from 'path';
import { resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';
import { FictionModel, Hashtag } from './FictionModel';
import { openAndSelectLine } from './Util';
import { homeDir } from './extension';

const ANALVIEW_KEY = 'analyticsView';

export class AnalyticsView {

    panel: vscode.WebviewPanel | undefined;
    private disposable: vscode.Disposable;

    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;
    lastLocation: { doc: vscode.TextDocument, line: number } | undefined;

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
        console.log("Analytics.dispose()");
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

    reload() {
        const currentDoc = vscode.window.activeTextEditor?.document;
        const currentLine = vscode.window.activeTextEditor?.selection.start.line;
        if (!(this.lastLocation?.doc===currentDoc &&
              this.lastLocation?.line===currentLine)) {
            this.lastLocation = { doc: currentDoc!, line: currentLine! };
            const fs = vscode.workspace.fs;
            const html = fs.readFile(vscode.Uri.file(
                path.join(this.context.extensionPath, 'analytics', 'index.html')
            )).then((data: Uint8Array) => {
                this.panel!.webview.html = data.toString().replace("${content}", this.generateContent()??"");
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

    generateContent(): string {
        let editor = vscode.window.activeTextEditor;
        if (editor===undefined) {
            return "";
        }
        let pos = editor.selection.start;
        
        // look for hashtags above
        let relatedTags: Hashtag[]=[];
        let thisTagLine = -1;
        for (let i = 0; i < 10 && pos.line - i >= 0; i++) {
            thisTagLine = pos.line-i;
            let line = editor.document.lineAt(thisTagLine).text;
            if (/<!--(.*?)-->/gu.test(line)) {
                for (let m of line.matchAll(/#([\p{L}\p{N}_\-\.]+)/gu)) {
                    let related = this.model.hashtagDB.query(m[1]);
                    if (related) {
                        relatedTags.push(...related);
                    }
                }
                break; 
            }
        }

        // sort by document order, remove tags at the same location
        relatedTags = relatedTags
                .sort((t1, t2)=>t1.compare(t2))
                .filter((t, index, tags)=> index===0 || !t.sameLocation(tags[index-1]));

        let output = "";
        let lastTag: Hashtag | undefined;

        return relatedTags.map( (t) => {
            if (t.docFile.filename===editor?.document.fileName && t.lineno===thisTagLine) {
                return `
                    <div class="current-location">
                        Current Position (${t.globalOffset})
                    </div>`;
            } else {
                let filename = vscode.workspace.asRelativePath(t.docFile.filename);
                let tags = t.tagLine.match(/<!--(.*?)-->/)?.[1]; // whatever is inside comment
                return ` 
                    <div class="related-text-header" onclick="openDoc('${filename}', ${t.lineno})">
                        <div class="tag-link">
                            ${filename}: ${t.lineno}
                        </div>
                        ${tags} (${t.globalOffset})
                    </div>
                    <div class="related-text">
                        ${t.contextText}
                    </div>`;
            }})
            .join(`<div class="related-separator">⋮</div>`) +
            `<div>total chars = ${this.model.totalChars}`;
    }
}
