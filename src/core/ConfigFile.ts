import * as yaml from 'yaml';
import * as path from 'path';

// Types for configuration structure
export type DocumentType = 'document' | 'individual';
export type OutputFormat = 'docx' | 'pdf' | 'html' | 'epub';
export interface FormatOptions {
    docx?: string;
    pdf?: string;
    epub?: string;
}

export interface FormatTemplates {
    docx?: string;
    pdf?: string;
    epub?: string;
}

export interface DocumentConfig {
    type?: DocumentType;
    content: string;
    formats?: OutputFormat[];
    template?: FormatTemplates;
    out_dir?: string;
    out_filename?: string;
    options?: FormatOptions;
}

export interface WorkspaceConfig {
    [key: string]: DocumentConfig | string;  // String for shorthand syntax
}

// Class to represent a fully processed document configuration
export class Document {
    readonly name: string;
    readonly type: DocumentType;
    readonly content: string;
    readonly formats: OutputFormat[];
    readonly template: FormatTemplates;
    readonly out_dir: string;
    readonly out_filename: string;
    readonly options: FormatOptions;

    constructor(
        name: string,
        config: DocumentConfig,
        defaults: DocumentConfig
    ) {
        this.name = name;
        this.type = config.type || defaults.type || 'document';
        this.content = config.content;
        this.formats = config.formats || defaults.formats || ['docx'];
        this.out_dir = config.out_dir || defaults.out_dir || '${content}/out';
        this.template = { ...defaults.template, ...config.template };
        this.out_filename = config.out_filename || defaults.out_filename || '${name}.${format}';
        this.options = { ...defaults.options, ...config.options };
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

// Main configuration parser class
export class ConfigParser {
    private config: WorkspaceConfig;
    private defaults: DocumentConfig;
    private documents: Map<string, Document>;

    constructor(yamlContent: string) {
        try {
            this.config = yaml.parse(yamlContent);
            this.documents = new Map();
            this.defaults = this.parseDocumentConfig(
                this.config['Default'] || {} as DocumentConfig,
                {
                    type: 'document',
                    content: '',
                    formats: ['docx'],
                    out_dir: '${content}/out',
                    out_filename: '${name}.${format}'
                }
            );
            delete this.config['Default'];

            // Parse remaining documents
            for (const [name, cfg] of Object.entries(this.config)) {
                // Handle shorthand syntax
                const fullConfig = typeof cfg === 'string'
                    ? { content: cfg }
                    : cfg;

                const docConfig = this.parseDocumentConfig(fullConfig, this.defaults);
                this.documents.set(name, new Document(name, docConfig, this.defaults));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse configuration: ${errorMessage}`);
        }
    }

    private parseDocumentConfig(
        config: DocumentConfig | string,
        defaults: DocumentConfig
    ): DocumentConfig {
        if (typeof config === 'string') {
            return { content: config };
        }

        // Validate formats
        if (config.formats) {
            const formatArray = Array.isArray(config.formats)
                ? config.formats
                : String(config.formats).split(',').map(f => f.trim());

            config.formats = formatArray
                .map(f => f.toLowerCase())
                .filter(f => ['docx', 'pdf', 'html', 'epub'].includes(f)) as OutputFormat[];
        }

        return config;
    }

    // Get all document configurations
    getDocuments(): Document[] {
        return Array.from(this.documents.values());
    }

    // Get individual document configurations
    getIndividualDocuments(): Document[] {
        return this.getDocuments().filter(doc => doc.type === 'individual');
    }

    // Get combined document configurations
    getCombinedDocuments(): Document[] {
        return this.getDocuments().filter(doc => doc.type === 'document');
    }

    // Get a specific document by name
    getDocument(name: string): Document | undefined {
        return this.documents.get(name);
    }
}

// Usage example
export function parseConfig(yamlContent: string): ConfigParser {
    try {
        return new ConfigParser(yamlContent);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse configuration: ${errorMessage}`);
    }
}

// Example usage:
// const config = `
// Default:
//     formats: ["docx"]
//     output: \${content}/out
//
// My Novel:
//     content: "content/novel/*.md"
//     formats: ["docx", "epub"]
//     output: "content/novel/out"
//
// Blog Posts:
//     type: individual
//     content: "content/blog/**/*.md"
//     formats: ["pdf"]
// `;
//
// const parser = parseConfig(config);
// const documents = parser.getDocuments();
// const blogPosts = parser.getIndividualDocuments();
// const novel = parser.getDocument('My Novel');