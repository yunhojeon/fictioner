import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Constants representing the dimensions of a page in fixed-width font
const COLUMNS_PER_PAGE = 20;
const ROWS_PER_PAGE = 10;

function replaceRepeatedNewlines(s: string): string {
    let newline = '\n'; // Use '\n' for newlines in TypeScript by default
    let pattern = new RegExp(`(${newline}){2,}`, 'g');
    return s.replace(pattern, (match) => newline.repeat(match.length / newline.length - 1));
}

function markdownToPlainText(mdContent: string): string {
    mdContent = mdContent.replace(/^\\newscene/gm, '\n   * * *   \n\n');
    mdContent = mdContent.replace(/^\\n/gm, '&nbsp;\n\n');

    let result = child_process.execSync('pandoc -f markdown -t plain --wrap=none', {
        input: mdContent,
        encoding: 'utf-8'
    });

    let text = replaceRepeatedNewlines(result);
    return text;
}

function calculatePagesFromPlainText(textContent: string, newPagePerSection: boolean): number {
    let lines = textContent.split('\n');
    let totalRows = 0;
    for (let line of lines) {
        let lineRows = Math.ceil(line.length / COLUMNS_PER_PAGE);
        totalRows += lineRows;
        if (newPagePerSection && line.startsWith("#")) {
            let remainingRowsOnPage = ROWS_PER_PAGE - (totalRows % ROWS_PER_PAGE);
            totalRows += remainingRowsOnPage;
        }
    }

    let pages = Math.ceil(totalRows / ROWS_PER_PAGE);
    return pages;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.calculatePages', () => {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: true,
            openLabel: 'Open',
            filters: {
                'Markdown files': ['md']
            }
        };

        vscode.window.showOpenDialog(options).then(fileUri => {
            if (fileUri && fileUri[0]) {
                let concatenatedMdContent = '';
                for (let uri of fileUri) {
                    concatenatedMdContent += fs.readFileSync(uri.fsPath, 'utf-8') + "\n\n";
                }

                const plainTextContent = markdownToPlainText(concatenatedMdContent);
                const totalPages = calculatePagesFromPlainText(plainTextContent, false);

                vscode.window.showInformationMessage(`The document will occupy approximately ${totalPages} pages.`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
