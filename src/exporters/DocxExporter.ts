import { ExporterError } from '../core/types';

function parsePandocError(stderr: string): ExporterError | null {
    const match = stderr.match(/at line (\d+), column (\d+)/);
    if (!match) {
        return null;
    }

    const line = parseInt(match[1], 10);
    const column = parseInt(match[2], 10);
    const message = stderr.trim();

    return {
        line,
        column,
        message
    };
}

export async function exportToDocx(src: string): Promise<Buffer> {
    const execa = require('execa');
    try {
        const { stdout } = await execa('pandoc', [
            '--from', 'markdown',
            '--to', 'docx',
            '--fail-if-warnings',
            '-o', '-' // Output to stdout
        ], {
            input: src,
            encoding: 'buffer'
        });

        return stdout as Buffer;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw new Error('Pandoc is not installed or not found in PATH');
        }

        const pandocError = parsePandocError(error.stderr);
        if (pandocError) {
            throw pandocError;
        }

        throw new Error(`Pandoc failed:\n${error.stderr}`);
    }
}
