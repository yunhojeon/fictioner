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
    findFiles(glob: string, exclude?: string): Promise<string[]>;
    readFile(path: string): Promise<string>;
}