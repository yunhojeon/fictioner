# Configuration File Format

The extension uses YAML format for configuration. The configuration file specifies how documents are processed, including their source files, output formats, and processing options.

## Structure

The configuration file consists of document definitions, with an optional `default` section that provides default values for all documents.

Each document can be either:

- A combined document (multiple Markdown files combined into one output)
- Individual documents (each Markdown file processed separately)

## Basic Example

```yaml
My Story:
  content: content/mystory/*.md
  formats: docx, epub
  output: ${content.dir}/releases/${name}-draft-${date}.${format}
```

A minimal document definition can just specify the content pattern:

```yaml
Quick Notes: content/notes/*.md  # Uses default settings
```

## Configuration Fields

### Required Fields

- `content`: Glob pattern specifying the Markdown files to process (e.g., `content/mystory/*.md`)

### Optional Fields

- `type`: Document processing type
  - `combined`: Multiple files combined into one output (default)
  - `individual`: Each file processed separately
- `formats`: Output formats (comma-separated)
  - Supported formats depend on the processor (e.g., pandoc)
  - Example: `docx, pdf, epub`
- `output`: Output file path template
  - Can include variables (see below)
  - Example: `${content.dir}/releases/${name}-${date}.${format}`
- `template`: Format-specific template files
  - Specified per format
  - Example:

    ```yaml
    template:
      docx: templates/novel.docx
      pdf: templates/default.latex
      epub: templates/book.epub
    ```

- `options`: Format-specific command-line options
  - Specified per format
  - Example:

    ```yaml
    options:
      docx: --toc --number-sections
      pdf: --pdf-engine=xelatex --template=${template.pdf}
    ```

## Variables

The following variables can be used in `output` paths:

- `${content.dir}`: Directory of the content file(s)
  - For combined documents: directory of first content file
  - For individual documents: directory of each content file
- `${content.name}`: Base name of the content file (without extension)
- `${content.ext}`: Extension of the content file
- `${name}`: Document name from configuration
- `${date}`: Current date
- `${format}`: Output format extension
- `${template.format}`: Path to template for specific format

## Complete Example

```yaml
default:
  content: content/**/*.md
  formats: docx
  type: combined
  output: ${content.dir}/out/${name}-${date}.${format}
  template:
    docx: templates/default.docx
    pdf: templates/default.latex
  options:
    docx: --toc --number-sections
    pdf: --pdf-engine=xelatex

My Story:
  content: content/mystory/*.md
  formats: docx, epub
  output: ${content.dir}/releases/${name}-draft-${date}.${format}
  template:
    docx: templates/novel.docx
    epub: templates/novel.epub
  options:
    docx: --reference-doc=${template.docx} --toc
    epub: --toc --epub-cover-image=cover.jpg

Blog Posts:
  content: content/blog/**/*.md
  type: individual
  formats: pdf
  output: ${content.dir}/post-${date}.${format}
  template:
    pdf: templates/blog.latex
  options:
    pdf: --pdf-engine=xelatex --template=${template.pdf}
```

## File Organization Tips

For combined documents (like books), it's recommended to use numerical prefixes for content files to maintain order:

```
100_chapter_one.md
110_chapter_two.md
120_chapter_three.md
```

This ensures:

- Files appear in correct order in file explorer
- Easy to insert new chapters (e.g., `105_new_chapter.md`)
- No need for explicit order configuration
