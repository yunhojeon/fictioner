// utility functions
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";

export async function readTextFile(file: vscode.Uri ): Promise<string> {
    let content = await vscode.workspace.fs.readFile(file);
    // return Buffer.from(f).toString('utf8');
    return new TextDecoder('utf8').decode(content);
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
