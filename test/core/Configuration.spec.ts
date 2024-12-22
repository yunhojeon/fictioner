import { Document, DocumentConfig, OutputFormat, ConfigParser } from '../../src/core/ConfigFile';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import path from 'path';

// Utility function to normalize paths for cross-platform testing
const normalizePath = (p: string) => path.normalize(p).replace(/\\/g, '/');

describe('Document', () => {
    const defaultConfig: DocumentConfig = {
        type: 'document',
        content: '',
        formats: ['docx'],
        output: '${content}/out',
        template: {},
        filename: '${name}.${format}',
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
                filename: 'custom-${name}.${format}',
                options: {}
            };

            const doc = new Document('test', config, defaultConfig);

            expect(doc.type).to.equal('document');
            expect(normalizePath(doc.content)).to.equal(normalizePath('content/path'));
            expect(doc.formats).to.deep.equal(['pdf']);
            expect(normalizePath(doc.output)).to.equal(normalizePath('custom/output'));
            expect(doc.template).to.deep.equal({ pdf: 'template.pdf' });
            expect(doc.filename).to.equal('custom-${name}.${format}');
            expect(doc.options).to.deep.equal({});
        });

        it('should use default values when config values are missing', () => {
            const config: DocumentConfig = {
                content: 'content/path'
            };

            const doc = new Document('test', config, defaultConfig);

            expect(doc.type).to.equal('document');
            expect(normalizePath(doc.content)).to.equal(normalizePath('content/path'));
            expect(doc.formats).to.deep.equal(['docx']);
            expect(doc.output).to.equal('${content}/out');
            expect(doc.template).to.deep.equal({});
            expect(doc.filename).to.equal('${name}.${format}');
            expect(doc.options).to.deep.equal({});
        });
    });

    describe('resolveOutput', () => {
        it('should replace ${content} with content directory path', () => {
            const config: DocumentConfig = {
                content: 'path/to/content/file.md'
            };

            const doc = new Document('test', config, defaultConfig);
            const expected = normalizePath('path/to/content/out');
            const actual = normalizePath(doc.resolveOutput());

            expect(actual).to.equal(expected);
        });
    });

    describe('resolveFilename', () => {
        it('should replace variables in filename template', () => {
            const config: DocumentConfig = {
                content: 'content/path',
                filename: '${name}-${date}.${format}'
            };

            const doc = new Document('test', config, defaultConfig);
            const date = new Date('2024-01-01');
            const format: OutputFormat = 'docx';

            expect(doc.resolveFilename(format, date))
                .to.equal('test-2024-01-01.docx');
        });
    });
});

describe('ConfigParser', () => {
    const configText = readFileSync('testdata/fictioner.yml', 'utf8');

    it('should parse config file and create Document objects', () => {
        const parser = new ConfigParser(configText);
        const documents = parser.getDocuments();
        expect(documents.length).to.equal(2);
    });

    it('should correctly identify combined documents', () => {
        const parser = new ConfigParser(configText);
        const combDocs = parser.getCombinedDocuments();
        expect(combDocs.length).to.equal(1);
        expect(combDocs[0].name).to.equal('My Novel');
    });

    it('should correctly identify individual documents', () => {
        const parser = new ConfigParser(configText);
        const indiDocs = parser.getIndividualDocuments();
        expect(indiDocs.length).to.equal(1);
        expect(indiDocs[0].name).to.equal('Blog Posts');
        expect(indiDocs[0].type).to.equal('individual');
    });
});

