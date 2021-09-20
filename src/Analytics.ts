import * as vscode from 'vscode';
import { EXT_NAME } from './extension';

export class Analytics implements vscode.TextDocumentContentProvider {

    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    private disposable: vscode.Disposable;

    constructor(public viewUri:vscode.Uri) {
        let subscriptions: vscode.Disposable [] = [];
        vscode.window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);
        vscode.window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        this.disposable = vscode.Disposable.from(...subscriptions);
    }

    private onEvent() {
        let uri = vscode.window.activeTextEditor?.document.uri;
        // TODO: check if it is one of the content files
        if (uri && uri.scheme==="file" && uri.fsPath.endsWith(".md")) {
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
        let line = editor.document.lineAt(pos.line).text;
        let filename = vscode.workspace.asRelativePath(editor.document.uri);
        return `${filename} ${pos?.line}:${pos?.character}\n${line}`;
    }
};