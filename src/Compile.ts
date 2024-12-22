import { DocumentProcessor } from './core/DocumentProcessor';
import * as vscode from 'vscode';
import path from 'path';
import { exec } from 'child_process';

export class Compile {
    private dp = new DocumentProcessor();

    async runPandoc(inputPath: string): Promise<string> {
        const outputFile = await this.dp.createTempFile('.docx');

        try {
            await new Promise<void>((resolve, reject) => {
                exec(
                    `pandoc "${inputPath}" -o "${outputFile.path}" --fail-if-warnings`,
                    (error, stdout, stderr) => {
                        if (error) {
                            const pandocError = this.parsePandocError(stderr);
                            if (pandocError) {
                                const originalLocation = this.dp.mapLineToOriginal(pandocError.line);
                                if (originalLocation) {
                                    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
                                    const relativePath = path.relative(workspacePath, originalLocation.file);
                                    reject(new Error(
                                        `Error in file "${relativePath}" at line ${originalLocation.line}:\n` +
                                        `${pandocError.message}`
                                    ));
                                    return;
                                }
                            }
                            reject(error);
                        } else {
                            resolve();
                        }
                    }
                );
            });
            return outputFile.path;
        } catch (error) {
            throw error;
        }
    }

    private parsePandocError(stderr: string): { line: number; message: string } | null {
        // Implementation of error parsing
        return null;
    }
}