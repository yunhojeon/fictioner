import { DocumentConfig, OutputFormat, ConfigParser } from '../../src/core/Config';
import { Document } from '../../src/core/Document';
import { readFile } from 'fs/promises';
import path from 'path';
import { FileSystem } from '../../src/core/types';
import { glob } from 'glob';

const normalizePath = (p: string) => path.normalize(p).replace(/\\/g, '/');
const fs: FileSystem = {
    findFiles: async (pattern, exclude) => {
        return glob(pattern, { ignore: exclude });
    },
    readFile: (path: string) => readFile(path, 'utf8')
}

describe('Document', () => {
    const defaultConfig: DocumentConfig = {
        content: "*.md"
    };

    describe('constructor', () => {
        it('should use provided config values', () => {
            const config: DocumentConfig = {
                type: 'document',
                content: 'content/path',
                formats: ['pdf'],
                output: 'custom/output',
                template: { pdf: 'template.pdf' },
                options: {}
            };

            const doc = new Document('test', config, defaultConfig, fs);

            expect(doc.type).toBe('document');
            expect(normalizePath(doc.content)).toBe(normalizePath('content/path'));
            expect(doc.formats).toEqual(['pdf']);
            expect(normalizePath(doc.out_dir)).toBe(normalizePath('custom/output'));
            expect(doc.template).toEqual({ pdf: 'template.pdf' });
            expect(doc.output).toBe('custom/output');
            expect(doc.options).toEqual({});
        });

        it('should use default values when config values are missing', () => {
            const config: DocumentConfig = {
                content: 'content/path'
            };

            const doc = new Document('test', config, defaultConfig, fs);

            expect(doc.type).toBe('document');
            expect(normalizePath(doc.content)).toBe(normalizePath('content/path'));
            expect(doc.formats).toEqual(['docx']);
            expect(doc.template).toEqual({});
            expect(doc.options).toEqual({});
        });
    });
});

describe('ConfigParser', () => {
    let parser: ConfigParser;
    const originalCwd = process.cwd();

    beforeAll(async () => {
        process.chdir(path.join(originalCwd, 'test/data'));
        const configText = await readFile('fictioner.yml', 'utf8');
        parser = new ConfigParser(configText, fs);
    });

    afterAll(() => {
        process.chdir(originalCwd);
    });

    it('should parse config file and create Document objects', () => {
        const documents = parser.getDocuments();
        expect(documents).toHaveLength(2);
    });

    it('there should be one combined document', () => {
        const combDocs = parser.getCombinedDocuments();
        expect(combDocs).toHaveLength(1);
    });

    it('should create combined Document object', async () => {
        const combDocs = parser.getCombinedDocuments();
        const myNovel = combDocs[0];
        expect(myNovel.name).toBe('My Novel');
        let model = await myNovel.readContent();
        expect(model.compiledMarkdown).toContain('Chapter 1');
    });

    it('should correctly identify individual documents', () => {
        const indiDocs = parser.getIndividualDocuments();
        expect(indiDocs).toHaveLength(1);
        expect(indiDocs[0].name).toBe('Blog Posts');
        expect(indiDocs[0].type).toBe('individual');
    });
});
