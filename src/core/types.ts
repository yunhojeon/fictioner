import { ContentFile } from './ContentFile'

export class SrcRange {
    constructor(
        public file: ContentFile,
        public startLine: number,
        public startCharacter: number,
        public endLine: number,
        public endCharacter: number) {
    }
}

export interface FileSystem {
    findFiles(pattern: string, exclude?: string): Promise<string[]>;
    readFile(path: string): Promise<string>;
}

export type ExporterError = {
    line: number;
    column: number;
    message: string;
};