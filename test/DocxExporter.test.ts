import { exportToDocx } from '../src/exporters/DocxExporter';
import { expect, beforeAll } from '@jest/globals';

async function isPandocAvailable(): Promise<boolean> {
    try {
        const execa = require('execa');
        await execa('pandoc', ['--version']);
        return true;
    } catch {
        return false;
    }
}

describe('DocxExporter', () => {
    describe('Real Pandoc tests', () => {
        beforeAll(async () => {
            const hasPandoc = await isPandocAvailable();
            if (!hasPandoc) {
                console.warn('Pandoc is not installed. Skipping real Pandoc tests.');
                return;
            }
        });

        it('should convert actual markdown to docx', async () => {
            jest.setTimeout(10000);
            const markdown = '# Hello World\n\nThis is a test.';
            const result = await exportToDocx(markdown);

            // DocX files start with PK magic number
            expect(result.subarray(0, 2).toString('hex')).toBe('504b');
        });
    });
});

