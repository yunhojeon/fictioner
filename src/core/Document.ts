import { ContentModel } from './ContentModel';
import { FileSystem } from './types';
import { DocumentConfig, DocumentType, FormatOptions, FormatTemplates, OutputFormat } from "./Config";


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

    async readContent() {
        this.model = new ContentModel(this, this.fs);
        await this.model.readContent();
    }

    // Resolve variables in output path
    resolveOutput(): string {
        return this.out_dir.replace('${content}', path.dirname(this.content));
    }

    // Resolve variables in filename template
    resolveFilename(format: OutputFormat, date: Date = new Date()): string {
        let filename = this.out_filename
            .replace('${name}', this.name)
            .replace('${format}', format)
            .replace('${date}', this.formatDate(date));

        if (!filename.endsWith(format)) {
            filename = `${filename}.${format}`;
        }

        return filename;
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }
}