import { SrcLocation } from './types'

export enum SemanticTagKind {
    Raised,
    Progressing,
    Resolved,
    Repeated
}

export class SemanticTag {

    kind: SemanticTagKind;
    id: string;

    constructor(
        public srcLocation: SrcLocation,
        token: string) {
        if (token.endsWith('?')) {
            this.kind = SemanticTagKind.Raised;
            this.id = token.substring(1, token.length - 2);
        } else if (token.endsWith('+')) {
            this.kind = SemanticTagKind.Progressing;
            this.id = token.substring(1, token.length - 2);
        } else if (token.endsWith('!')) {
            this.kind = SemanticTagKind.Resolved;
            this.id = token.substring(1, token.length - 2);
        } else {
            this.kind = SemanticTagKind.Repeated;
            this.id = token.substring(1);
        }
    }
}