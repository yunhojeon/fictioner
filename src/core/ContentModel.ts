import { SemanticTag, SemanticTagKind } from './SemanticTag';
import { DocumentConfig } from './Config';
import { ContentFile } from './ContentFile';
import { SrcRange, FileSystem, ExporterError } from './types';

type Diagnostic = {
  range: SrcRange;
  message: string;
  kind: 'error' | 'warning';
}

export class ContentModel {

  // hashtag database
  private semanticTags: SemanticTag[] = [];                   // all hashtags, document order
  private fictionFiles: ContentFile[] = [];
  public compiledMarkdown: string = '';
  public mapTable: { [key: number]: number } = {};
  private frontMatter: string = '';
  private diagnostics: Diagnostic[] = [];

  constructor(
    private readonly config: DocumentConfig,
    private readonly fs: FileSystem) {
  }

  async readContent() {

    const files = await this.fs.findFiles(this.config.content)
      .then(files => files.sort());

    this.fictionFiles = await Promise.all(files.map(async (file) => {
      let text = await this.fs.readFile(file);
      return new ContentFile(text);
    }));

    this.compile();
    this.checkHashtags();
  }

  compile() {
    this.semanticTags = [];
    this.compiledMarkdown = '';
    this.mapTable = {};
    for (let file of this.fictionFiles) {
      let { frontMatter, processedMarkdown, mapTable } = file.processMarkdown();
      this.semanticTags.push(...file.semanticTags);
      this.compiledMarkdown += processedMarkdown;
      this.mapTable = { ...this.mapTable, ...mapTable };
    }
  }

  checkHashtags() {
    this.diagnostics = []
    this.semanticTags.forEach((tag, index) => {
      let message: string | undefined;
      let severity: string | undefined;
      switch (tag.kind) {
        case SemanticTagKind.Repeated:
          // this tag is to be used for repeating motifs
          // let's warn if there's only one of its kind
          if (!this.semanticTags.some(other =>
            other.id === tag.id && other.kind === tag.kind && other !== tag)) {
            message = 'not repeated';
            severity = 'warning';
          }
          break;
        case SemanticTagKind.Raised:
          {
            if (this.semanticTags.slice(0, index).some(other =>
              other.id === tag.id && other.kind === tag.kind)) {
              message = 'duplicate question';
              severity = 'error';
            }
            if (!this.semanticTags.slice(index + 1).some(other =>
              other.id === tag.id && other.kind === SemanticTagKind.Resolved)) {
              message = 'not answered';
              severity = 'error';
            }
          }
          break;
        case SemanticTagKind.Progressing:
          {
            if (!this.semanticTags.slice(0, index).some(other =>
              other.id === tag.id && other.kind === SemanticTagKind.Raised)) {
              message = 'progression without raise';
              severity = 'error';
            }
            if (!this.semanticTags.slice(0, index).some(other =>
              other.id === tag.id && other.kind === SemanticTagKind.Resolved)) {
              message = 'progression after resolution';
              severity = 'error';
            }
          }
          break;
        case SemanticTagKind.Resolved:
          {
            if (!this.semanticTags.slice(0, index).some(other =>
              other.id === tag.id && other.kind === SemanticTagKind.Raised)) {
              message = 'resolved without raise';
              severity = 'error';
            }
            if (this.semanticTags.slice(0, index).some(other =>
              other.id === tag.id && other.kind === tag.kind)) {
              message = 'duplicate resolution';
              severity = 'error';
            }
          }
          break;
      }
      if (message) {
        this.diagnostics.push({
          range: tag.srcRange,
          message: message,
          kind: severity as 'error' | 'warning'
        });
      }
    });
  }
}