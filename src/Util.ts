// utility functions
import { TextDecoder, TextEncoder } from "util";
import { homeDir } from "./extension";
import * as vscode from "vscode";

export async function readTextFile(file: vscode.Uri | string ): Promise<string> {
    if (typeof file === "string") {
        file = vscode.Uri.file(file);
    }
    let content = await vscode.workspace.fs.readFile(file);
    // return Buffer.from(f).toString('utf8');
    return new TextDecoder().decode(content);
} 

export async function writeTextFile(file: vscode.Uri, content: string) {
    vscode.workspace.fs.writeFile(file, new TextEncoder().encode(content));
}

export function formatString(source: string, values: Map<string, string>) {
	return source.replace(
		/{(\w+)}/g,
		(withDelim: string, woDelim: string) => values.get(woDelim) ?? withDelim
	);
}

export function openAndSelectLine(uri: vscode.Uri, lineno: number) {
    // console.log(`showing ${args[0]}`);
    const range = new vscode.Range(new vscode.Position(lineno, 0), new vscode.Position(lineno, 0));

    vscode.window.showTextDocument(uri, { preview: false, viewColumn: vscode.ViewColumn.One }).then(
        (editor: vscode.TextEditor) => {
            editor.revealRange(range);
            editor.selection = new vscode.Selection(range.start, range.end);
        }
    );
}