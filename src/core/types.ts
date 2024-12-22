import { FictionFile } from './FictionFile'

export class SrcLocation {

    // line and character are zero-based. to be compatible with vscode's Position
    constructor(
        public file: FictionFile,
        public line: number,
        public character: number) {
    }
}
