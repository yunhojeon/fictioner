// import type MarkdownIt = require('markdown-it');
import type { remark } from 'remark';
import { import_ } from '@brillout/import';

export class MFDoc {
    // represents single file
    // this class is responsible for preprocessing the file and holding results
    private src: string | undefined;
    private output: string | undefined;
    // private _md?: Promise<typeof remark>;

    constructor(src: string | undefined) {
        this.setSrc(src);
    }

    public setSrc(src: string | undefined) {
        if (this.src !== src) {
            this.src = src;
            this.output = undefined;
        }
        // do nothing if same content is set
    }

    public async getResult(): Promise<string | undefined> {
        if (this.src) {
            // this.output = this.src.replace(/\n/g, '<w:p/>');
            const file = await (await this.getProcessor()).process(this.src);
            this.output = String(file);
        }
        return this.output;
    }

    private async getProcessor(): Promise<typeof remark> {
        const processor = (await import_('remark')).remark;
        return processor;
    }
}