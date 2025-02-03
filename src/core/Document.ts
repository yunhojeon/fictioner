import { ContentModel } from './ContentModel';
import { FileSystem } from './types';
import { DocumentConfig, DocumentType, FormatOptions, FormatTemplates, OutputFormat } from "./Config";
import path from 'path';


// Class to represent a fully processed document configuration
export class Document {
    readonly name: string;
    readonly type: DocumentType;
    readonly content: string;
    readonly formats: OutputFormat[];
    readonly template: FormatTemplates;
    readonly out_dir: string;
    readonly output: string;
    readonly options: FormatOptions;
    model: ContentModel | undefined;

    constructor(
        name: string,
        config: DocumentConfig,
        defaults: DocumentConfig,
        private fs: FileSystem
    ) {
        this.name = name;
        this.type = config.type || defaults.type || 'document';
        this.content = config.content;
        this.formats = config.formats || defaults.formats || ['docx'];
        this.out_dir = config.output || defaults.output || '${content}/out';
        this.template = { ...defaults.template, ...config.template };
        this.output = config.output || defaults.output || '${name}.${format}';
        this.options = { ...defaults.options, ...config.options };
    }

    async readContent(): Promise<ContentModel> {
        this.model = new ContentModel(this, this.fs);
        await this.model.readContent();
        return this.model;
    }

    // Resolve variables in output path
    resolveOutput(): string {
        return this.out_dir.replace('${content.dir}', path.dirname(this.content));
    }

    // Resolve variables in filename template
    resolveFilename(format: OutputFormat, date: Date = new Date()): string {
        const contentPath = this.content;
        const contentDir = path.dirname(contentPath);
        const contentName = path.basename(contentPath, path.extname(contentPath));
        const contentExt = path.extname(contentPath);
        // const templatePath = this.template[format];

        let filename = this.output
            .replace(/\${content\.dir}/g, contentDir)
            .replace(/\${content\.name}/g, contentName)
            .replace(/\${content\.ext}/g, contentExt)
            .replace(/\${name}/g, this.name)
            .replace(/\${format}/g, format)
            .replace(/\${date}/g, this.formatDate(date));
        // .replace(/\${template\.(.*?)}/g, (_, fmt) => this.template[fmt as OutputFormat] || '');

        if (!filename.endsWith(format)) {
            filename = `${filename}.${format}`;
        }

        return filename;
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }
}