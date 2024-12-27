import { SemanticTag, SemanticTagKind } from './SemanticTag'
import { SrcLocation } from './types'

export class FictionFile {
    semanticTags: SemanticTag[] = [];
    // markdown content is given as string
    constructor(
        public src: string) {
    }

    // this function processes the markdown content
    // and returns the frontmatter, processed content and mapTable
    // processing rules: 
    // 1. Extract frontmatter if present
    // 2. Pass HTML comments to processComment. Remove them from the output. Remove entire line if it contained comment only.
    // 3. Replace line separators '***' with '\scenechange'
    // 4. Replace more than one consecutive blank lines with '\n' + '&nbsp;\n'.repeat(n-1) + '\n' (n is number of blank lines)
    // 5. Prepend backslash to curly quotes
    // 6. Build mapTable to map line numbers in the processed content to the original content
    // 7. Add one blank line at the end
    public processMarkdown(): { frontMatter: string, out: string, mapTable: { [key: number]: number } } {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\t*\n/;
        const htmlCommentRegex = /<!--[\s\S]*?-->/g;
        const lineSeparatorRegex = /^\*\*\*$/gm;
        const curlyQuoteRegex = /[\u2018\u2019\u201C\u201D]/g;  // Unicode for ''""

        let frontMatter = '';
        let src = this.src;
        let out = '';
        let frontMatterOffset = 0;
        const mapTable: { [key: number]: number } = {};

        // Extract frontmatter
        const frontMatterMatch = this.src.match(frontMatterRegex);
        if (frontMatterMatch) {
            frontMatter = frontMatterMatch[1];
            frontMatterOffset = frontMatterMatch[1].split('\n').length + 2;
            src = src.replace(frontMatterRegex, '');
        }
        // Ensure src ends with newline
        if (!src.endsWith('\n')) {
            src += '\n';
        }
        let lines = src.split('\n');
        let outLineNum = 0;
        let consecutiveBlankLines = 0;

        // Process line by line
        lines.forEach((line, srcLineNum) => {
            const originalLineEmpty = !line.trim();

            // Process HTML comments and clean up spaces first
            let processedLine = line
                .replace(htmlCommentRegex, (match, p1, offset) => {
                    const comment = match.replace(/<!--([\s\S]*?)-->/, '$1');
                    this.processComment(comment, srcLineNum, offset);
                    return '';
                });

            // Skip only if line was not originally empty and became empty after comment removal
            if (!processedLine && !originalLineEmpty) {
                return;
            }

            // Handle line separators
            processedLine = processedLine.replace(lineSeparatorRegex, '\\scenechange');
            // Process curly quotes
            // this is needed because pandoc replaces curly quotes with straight quotes if not escaped
            processedLine = processedLine.replace(curlyQuoteRegex, (match) => {
                return '\\' + match;
            });

            // Handle consecutive blank lines or originally empty lines
            if (originalLineEmpty) {
                consecutiveBlankLines++;
                if (consecutiveBlankLines > 1) {
                    processedLine = '&nbsp;';
                }
            } else {
                consecutiveBlankLines = 0;
            }

            // Append the processed line
            out += processedLine + '\n';
            mapTable[outLineNum++] = frontMatterOffset + srcLineNum;
        });

        return { frontMatter, out, mapTable };
    }

    processComment(comment: string, lineNum: number, column: number) {
        // find all semantic tags in the comment
        const hashTagRegex = /#[\p{L}\p{N}_\-\.\?\+!]+/gu;
        for (const match of comment.matchAll(hashTagRegex)) {
            this.semanticTags.push(
                new SemanticTag(new SrcLocation(this, lineNum, column + match.index!), match[0])
            );
        }
    }
}