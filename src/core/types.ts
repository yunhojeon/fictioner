import { FictionFile } from './FictionFile'

export class SrcLocation {

    // line and character are zero-based. to be compatible with vscode's Position
    constructor(
        public file: FictionFile,
        public line: number,
        public character: number) {
    }
}

export class SrcRange extends SrcLocation {
    constructor(
        public file: FictionFile,
        public startLine: number,
        public startCharacter: number,
        public endLine: number,
        public endCharacter: number) {
        super(file, startLine, startCharacter)
    }
}
