import { DocumentConfig, OutputFormat, ConfigParser } from '../../src/core/Config';
import { Document } from '../../src/core/Document';
import { expect } from 'chai';
import { readFile } from 'fs/promises';
import path from 'path';
import { FileSystem } from 'src/core/types';
import { glob } from 'glob';

// Utility function to normalize paths for cross-platform testing
const normalizePath = (p: string) => path.normalize(p).replace(/\\/g, '/');
const fs: FileSystem = {
    findFiles: glob,
    readFile: (path: string) => readFile(path, 'utf8')
}

describe('Document', () => {
    const defaultConfig: DocumentConfig = {
        type: 'document',
        content: '',
        formats: ['docx'],
        output: '${content}/out',
        template: {},
        output: '${name}.${format}',
        options: {}
    };

    describe('constructor', () => {
        it('should use provided config values', () => {
            const config: DocumentConfig = {
                type: 'document',
                content: 'content/path',
                formats: ['pdf'],
                output: 'custom/output',
                template: { pdf: 'template.pdf' },
                output: 'custom-${name}.${format}',
                options: {}
            };

            const doc = new Document('test', config, defaultConfig, fs);

            expect(doc.type).to.equal('document');
            expect(normalizePath(doc.content)).to.equal(normalizePath('content/path'));
            expect(doc.formats).to.deep.equal(['pdf']);
            expect(normalizePath(doc.out_dir)).to.equal(normalizePath('custom/output'));
            expect(doc.template).to.deep.equal({ pdf: 'template.pdf' });
            expect(doc.output).to.equal('custom-${name}.${format}');
            expect(doc.options).to.deep.equal({});
        });

        it('should use default values when config values are missing', () => {
            const config: DocumentConfig = {
                content: 'content/path'
            };

            const doc = new Document('test', config, defaultConfig, fs);

            expect(doc.type).to.equal('document');
            expect(normalizePath(doc.content)).to.equal(normalizePath('content/path'));
            expect(doc.formats).to.deep.equal(['docx']);
            expect(doc.out_dir).to.equal('${content}/out');
            expect(doc.template).to.deep.equal({});
            expect(doc.output).to.equal('${name}.${format}');
            expect(doc.options).to.deep.equal({});
        });
    });

    describe('resolveOutput', () => {
        it('should replace ${content} with content directory path', () => {
            const config: DocumentConfig = {
                content: 'path/to/content/file.md'
            };

            const doc = new Document('test', config, defaultConfig, fs);
            const expected = normalizePath('path/to/content/out');
            const actual = normalizePath(doc.resolveOutput());

            expect(actual).to.equal(expected);
        });
    });

    describe('resolveFilename', () => {
        it('should replace variables in filename template', () => {
            const config: DocumentConfig = {
                content: 'content/path',
                output: '${name}-${date}.${format}'
            };

            const doc = new Document('test', config, defaultConfig, fs);
            const date = new Date('2024-01-01');
            const format: OutputFormat = 'docx';

            expect(doc.resolveFilename(format, date))
                .to.equal('test-2024-01-01.docx');
        });
    });
});

describe('ConfigParser', () => {
    const configText = await readFile('fictioner.yml', 'utf8');
    const parser = new ConfigParser(configText, fs);
    const documents = parser.getDocuments();

    it('should parse config file and create Document objects', () => {
        expect(documents.length).to.equal(2);
    });

    const combDocs = parser.getCombinedDocuments();
    it('there should be one combined document', () => {
        expect(combDocs.length).to.equal(1);
    })

    it('should create combined Document object', () => {
        const myNovel = combDocs[0];
        expect(myNovel.name).to.equal('My Novel');
        expect(myNovel.)
    });

    it('should correctly identify individual documents', () => {
        const indiDocs = parser.getIndividualDocuments();
        expect(indiDocs.length).to.equal(1);
        expect(indiDocs[0].name).to.equal('Blog Posts');
        expect(indiDocs[0].type).to.equal('individual');
    });


});
