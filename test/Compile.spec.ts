import { DocumentProcessor } from '../src/Compile.ts';
import { describe, it } from 'mocha';
import assert from 'assert';
// const assert = require('assert');

describe('mergeMdFiles should merge markdown files', () => {
    it("should return merged text", async () => {
        const dp = new DocumentProcessor();
        const files = [
            '../testdata/c/Chapter 1/scene1-1.md',
            '../testdata/c/Chapter 1/scene1-2.md',
            '../testdata/c/Chapter 2/scene2-1.md',
            '../testdata/c/Chapter 2/scene2-2.md',
        ];
        const result = await dp.mergeMdFiles(files);
        assert.equal(result, 'Hello, world!');
    });
});
