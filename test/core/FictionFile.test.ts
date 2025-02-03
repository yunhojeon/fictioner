import { ContentFile } from '../../src/core/ContentFile';

describe('FictionFile', () => {
        it('should process markdown correctly', () => {
                const src = `---
title: Test
author: Author
---

# Heading

<!-- This is a comment -->
This is a paragraph.

***

Another paragraph.


'Curly quotes' and "double curly quotes".
`;

                const out = `# Heading

This is a paragraph.

\\scenechange

Another paragraph.

&nbsp;
'Curly quotes' and "double curly quotes".

`;

                const fictionFile = new ContentFile(src);
                const result = fictionFile.processMarkdown();

                expect(result.frontMatter).toBe(`title: Test\nauthor: Author`);
                expect(result.processedMarkdown).toBe(out);
                expect(Object.keys(result.mapTable).length).toBeGreaterThan(0);
        });

        it('should handle inline comments', () => {
                const src = `# Heading <!-- comment -->
Text with <!-- inline --> comment.
<!-- comment -->Only text remains.
`;
                const out = `# Heading 
Text with  comment.
Only text remains.

`;

                const fictionFile = new ContentFile(src);
                const result = fictionFile.processMarkdown();

                expect(result.processedMarkdown).toBe(out);
        });
});
