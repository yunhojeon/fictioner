import * as vscode from 'vscode';
import { execa } from 'execa';  // Change to default import
import { ContentModel } from './core/ContentModel';

function parsePandocError(stderr: string): { line: number; message: string } | null {
    // Implementation of error parsing
    return null;
}

function mapPandocError(error: { line: number; message: string }, model: ContentModel): string {
    const mappedLine = model.mapTable[error.line];
    if (mappedLine !== undefined) {
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
        // Note: We need to handle the file path differently since ContentModel's structure is different
        // You might need to adjust this based on how file information is stored in ContentModel
        return `Error at line ${mappedLine}:\n${error.message}`;
    }
    return error.message;
}

export async function compile(source: string, model: ContentModel): Promise<Buffer> {
    try {
        const { stdout } = await execa('pandoc', [
            '--from', 'markdown',
            '--to', 'docx',
            '--fail-if-warnings'
        ], {
            input: source,
            encoding: 'buffer' // Change from null to 'buffer'
        });

        return stdout as Buffer;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw new Error('Pandoc is not installed or not found in PATH');
        }

        const pandocError = parsePandocError(error.stderr);
        if (pandocError) {
            throw new Error(mapPandocError(pandocError, model));
        }

        throw new Error(`Pandoc failed:\n${error.stderr}`);
    }
}