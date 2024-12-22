import { strict as assert } from 'assert';
import { FictionFile } from '../../src/core/FictionFile';

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


‘Curly quotes’ and “double curly quotes”.
`;

        const out = `
# Heading

This is a paragraph.

\\scenechange

Another paragraph.

&nbsp;
\\‘Curly quotes\\’ and \\“double curly quotes\\”.

`;

        const fictionFile = new FictionFile(src);
        const result = fictionFile.processMarkdown();

        assert.equal(result.frontMatter, `title: Test\nauthor: Author`);
        assert.equal(result.out, out);
        assert.ok(Object.keys(result.mapTable).length > 0);
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

        const fictionFile = new FictionFile(src);
        const result = fictionFile.processMarkdown();

        assert.equal(result.out, out);
    });
});
