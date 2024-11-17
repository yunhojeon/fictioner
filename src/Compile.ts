import * as vscode from 'vscode';
import * as tmp from 'tmp';
import { file as tmpFile, FileResult } from 'tmp-promise';
import { exec } from 'child_process';
import * as path from 'path';

export class DocumentProcessor {

    private lineMappings: Array<{
        originalFile: string;
        startLine: number;
        lineCount: number;
    }> = [];

    /**
     * Creates a temporary file and returns a promise with the path
     */
    private async createTempFile(): Promise<FileResult> {
        return await tmpFile({ postfix: '.md' });
    }

    /**
     * Merges markdown files and keeps track of line mappings
     */
    async mergeMdFiles(files: string[]): Promise<{ path: string, cleanup: () => void }> {
        const tempFile = await this.createTempFile('.md');
        const mergedContent: string[] = [];
        this.lineMappings = [];

        let currentLine = 1;

        for (const file of files) {
            const content = await fs.readFile(file, 'utf8');
            const lines = content.split('\n');

            this.lineMappings.push({
                originalFile: file,
                startLine: currentLine,
                lineCount: lines.length
            });

            mergedContent.push(content);
            mergedContent.push('\n\n');

            currentLine += lines.length + 2;
        }

        await fs.writeFile(tempFile.path, mergedContent.join(''));
        return tempFile;
    }

    /**
     * Executes pandoc and processes any errors
     */
    async runPandoc(inputPath: string): Promise<string> {
        // Create temporary output file
        const outputFile = await this.createTempFile('.docx');

        try {
            await new Promise<void>((resolve, reject) => {
                exec(
                    `pandoc "${inputPath}" -o "${outputFile.path}" --fail-if-warnings`,
                    (error, stdout, stderr) => {
                        if (error) {
                            // Try to parse and map the error
                            const pandocError = this.parsePandocError(stderr);
                            if (pandocError) {
                                const originalLocation = this.mapLineToOriginal(pandocError.line);
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
                            return;
                        }
                        resolve();
                    }
                );
            });

            return outputFile.path;
        } catch (error) {
            // Clean up the output file if there was an error
            outputFile.cleanup();
            throw error;
        }
    }

    private parsePandocError(stderr: string): { line: number; message: string; } | null {
        const match = stderr.match(/line (\d+):/i);
        if (match) {
            return {
                line: parseInt(match[1], 10),
                message: stderr.trim()
            };
        }
        return null;
    }

    private mapLineToOriginal(mergedLine: number): { file: string; line: number; } | null {
        for (const mapping of this.lineMappings) {
            if (mergedLine >= mapping.startLine &&
                mergedLine < mapping.startLine + mapping.lineCount) {
                return {
                    file: mapping.originalFile,
                    line: mergedLine - mapping.startLine + 1
                };
            }
        }
        return null;
    }
}

// Example usage in your extension's activate function
export async function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('fiction-writer.exportToWord', async () => {
        let mergedFile: { path: string; cleanup: () => void; } | undefined;

        try {
            const processor = new DocumentProcessor();

            // Get all markdown files
            const mdFiles = await vscode.workspace.findFiles('**/*.md');
            const sortedFiles = mdFiles.map(file => file.fsPath)
                .sort((a, b) => a.localeCompare(b));

            // Create merged temporary file
            mergedFile = await processor.mergeMdFiles(sortedFiles);

            // Run pandoc and get output path
            const outputPath = await processor.runPandoc(mergedFile.path);

            vscode.window.showInformationMessage(
                `Export completed! Word document saved at: ${outputPath}`
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`Export failed: ${error.message}`);
        } finally {
            // Clean up the merged file
            if (mergedFile) {
                mergedFile.cleanup();
            }
        }
    });

    context.subscriptions.push(disposable);
}