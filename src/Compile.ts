import * as vscode from 'vscode';
import path from 'path';
import { spawn } from 'child_process';
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
    return new Promise((resolve, reject) => {
        const pandoc = spawn('pandoc', [
            '--from', 'markdown',
            '--to', 'docx',
            '--fail-if-warnings'
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });

        // Ensure binary mode for stdout
        if (pandoc.stdout.setEncoding) {
            pandoc.stdout.setEncoding('binary');
        }

        const chunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        pandoc.stdout.on('data', (chunk) => {
            // Ensure we're handling chunks as Buffer
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        pandoc.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));

        pandoc.on('error', (err) => {
            if (err.message.includes('ENOENT')) {
                reject(new Error('Pandoc is not installed or not found in PATH'));
            } else {
                reject(err);
            }
        });

        pandoc.on('close', (code) => {
            if (code !== 0) {
                const stderr = Buffer.concat(stderrChunks).toString();
                const pandocError = parsePandocError(stderr);
                if (pandocError) {
                    reject(new Error(mapPandocError(pandocError, model)));
                    return;
                }
                reject(new Error(`Pandoc failed with code ${code}:\n${stderr}`));
                return;
            }
            resolve(Buffer.concat(chunks));
        });

        pandoc.stdin.write(source);
        pandoc.stdin.end();
    });
}