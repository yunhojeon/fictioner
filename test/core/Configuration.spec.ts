import { Document, DocumentConfig, OutputFormat } from '../../src/core/Configuration';
import { expect } from 'chai';
import path from 'path';

describe('Document', () => {
    // Utility function to normalize paths for cross-platform testing
    const normalizePath = (p: string) => path.normalize(p).replace(/\\/g, '/');

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