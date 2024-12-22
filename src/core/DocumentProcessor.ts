import fs from 'fs/promises';
import { file as tmpFile, FileResult } from 'tmp-promise';

export class DocumentProcessor {
    lineMappings: Array<{ originalFile: string; startLine: number; lineCount: number }> = [];

    async createTempFile(postfix: string): Promise<{ path: string; cleanup: () => void }> {
        return await tmpFile({ postfix });
    }

    async mergeMdFiles(files: string[]): Promise<{ path: string; cleanup: () => void }> {
        const tempFile = await this.createTempFile('.md');
        const mergedContent: string[] = [];
        this.lineMappings = [];

        let currentLine = 1;

        for (const file of files) {
            const content = await fs.readFile(file, 'utf8');
            const lines = content.split('\n');

            // Skip frontmatter if present
            let startIndex = 0;
            if (lines[0].startsWith('---')) {
                startIndex = lines.indexOf('---', 1) + 1;
            }

            this.lineMappings.push({
                originalFile: file,
                startLine: currentLine,
                lineCount: lines.length - startIndex
            });

            mergedContent.push(lines.slice(startIndex).join('\n'));
            mergedContent.push('\n\n');

            currentLine += lines.length - startIndex + 2;
        }

        await fs.writeFile(tempFile.path, mergedContent.join(''));
        return tempFile;
    }

    mapLineToOriginal(mergedLine: number): { file: string, line: number } | null {
        for (const mapping of this.lineMappings) {
            if (mergedLine >= mapping.startLine && mergedLine < mapping.startLine + mapping.lineCount) {
                const originalLine = mergedLine - mapping.startLine + 1;
                return { file: mapping.originalFile, line: originalLine };
            }
        }
        return null;
    }
}