import fs from 'fs/promises';

export class DocumentProcessor {
    lineMappings: Array<{ originalFile: string; startLine: number; lineCount: number }> = [];

    async mergeMdFiles(files: string[]): Promise<string> {
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
        return mergedContent.join('')
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