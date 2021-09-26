import * as vscode from 'vscode';
import * as path from 'path';
import { resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';
import { FictionModel, Hashtag } from './FictionModel';

const ANALVIEW_KEY = 'analyticsView';

export class AnalyticsView {

    panel: vscode.WebviewPanel | undefined;
    private disposable: vscode.Disposable;

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
        console.log("Analytics.dispose()");
        this.disposable.dispose();
    }

    show() {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'fictioner', 'Fictioner Analytics',
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }
            );
            this.context.workspaceState.update(ANALVIEW_KEY, true);
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.context.workspaceState.update(ANALVIEW_KEY, false);
            });

            this.reload();
        }
    }

    reload() {
        const fs = vscode.workspace.fs;
        const html = fs.readFile(vscode.Uri.file(
            path.join(this.context.extensionPath, 'analytics', 'index.html')
        )).then((data: Uint8Array) => {
            this.panel!.webview.html = data.toString().replace("${content}", this.generateContent()??"");
        });
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
        if (!editor) {
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

        relatedTags = relatedTags.sort((t1, t2)=>t1.compare(t2));

        let output = "";
        let lastTag: Hashtag | undefined;
        for(let t of relatedTags) {
            // skip tags at same location
            if (lastTag?.docFile===t.docFile && lastTag.lineno===t.lineno) {
                continue;
            }
            lastTag = t;
            if (t.docFile.filename===editor.document.fileName && t.lineno===thisTagLine) {
                output += `<div class="current-location">Current Position</div>`;
            } else {
                let filename = vscode.workspace.asRelativePath(t.docFile.filename);
                let tags = t.tagLine.match(/<!--(.*?)-->/)?.[1]; // whatever is inside comment
                output += ` 
                <div class="related-text-header">
                    <div class="tag-link">
                        ${filename}: ${t.lineno}
                    </div>
                    ${tags}
                </div>
                <div class="related-text">
                    ${t.contextText}
                </div>
                <div class="related-separator">⋮</div>`;
            }

        }

        return output;
    }

}

export class Analytics implements vscode.TextDocumentContentProvider {

    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    private disposable: vscode.Disposable;

    constructor(public viewUri: vscode.Uri, public model: FictionModel) {
        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);
        vscode.window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        this.disposable = vscode.Disposable.from(...subscriptions);
    }

    private onEvent() {
        let uri = vscode.window.activeTextEditor?.document.uri;
        // TODO: check if it is one of the content files
        if (uri && uri.scheme === "file" && uri.fsPath.endsWith(".md")) {
            this.onDidChangeEmitter.fire(this.viewUri);
        }
    }

    public dispose() {
        console.log("Analytics.dispose()");
        this.disposable.dispose();
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
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

        relatedTags = relatedTags.sort((t1, t2)=>t1.compare(t2));

        let output = "";
        let lastTag: Hashtag | undefined;
        for(let t of relatedTags) {
            // skip tags at same location
            if (lastTag?.docFile===t.docFile && lastTag.lineno===t.lineno) {
                continue;
            }
            lastTag = t;
            if (t.docFile.filename===editor.document.fileName && t.lineno===thisTagLine) {
                output += "======================================\n\n";
            } else {
                let filename = vscode.workspace.asRelativePath(t.docFile.filename);
                let tags = t.tagLine.match(/<!--(.*?)-->/)?.[1]; // whatever is inside comment
                output += `<${filename}: ${t.lineno} ${tags}>\n${t.contextText}\n`;
            }

        }

        return output;
    }

}
