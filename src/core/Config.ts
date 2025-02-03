import * as yaml from 'yaml';
import { Document } from './Document';
import { FileSystem } from './types';

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
    output?: string;
    options?: FormatOptions;
}

export interface WorkspaceConfig {
    [key: string]: DocumentConfig | string;  // String for shorthand syntax
}

// Main configuration parser class
export class ConfigParser {
    private config: WorkspaceConfig;
    private defaults: DocumentConfig;
    private documents: Map<string, Document>;

    constructor(yamlContent: string, private fs: FileSystem) {
        try {
            this.config = yaml.parse(yamlContent);
            this.documents = new Map();
            this.defaults = this.parseDocumentConfig(
                this.config['Default'] || {} as DocumentConfig,
                {
                    type: 'document',
                    content: '',
                    formats: ['docx'],
                    output: '${content.dir}/out/${content.name}',
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
                this.documents.set(name, new Document(name, docConfig, this.defaults, this.fs));
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
// export function parseConfig(yamlContent: string): ConfigParser {
//     try {
//         return new ConfigParser(yamlContent);
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : String(error);
//         throw new Error(`Failed to parse configuration: ${errorMessage}`);
//     }
// }

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