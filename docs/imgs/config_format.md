# Configuration Format

The extension uses YAML format for configuration. The configuration file should be placed in the workspace root as `.vscode/fiction-writer.yml` (or your extension's specific filename).

## Structure

The configuration file consists of document definitions and special entries:

- Document definitions: Named entries describing complete works (books, stories, etc.)
- Individual documents: Entries marked with `type: individual` for files that should be processed independently
- `Default`: Special entry defining workspace-level default values

## Basic Example

```yaml
My Novel:
  content: content/novel/*.md
  formats: docx, epub
  output: content/novel/out

Blog Posts:
  type: individual
  content: content/blog/**/*.md
  formats: pdf
  output: ${content}
```

## Configuration Fields

### Top-Level Entries

- Document name (e.g., "My Novel"): Used as the work's title and in generated filenames
- `Default`: Special entry defining workspace-level default values

### Document Types

Each document entry can specify its type:

- `type: document` (default): Files are combined as chapters of a single work
- `type: individual`: Files are processed independently

### Fields for Each Entry

`content` (Required)

- Pattern matching the Markdown files to be included
- Uses glob pattern syntax (e.g., `*.md`, `**/*.md`)
- Examples:
  - `content/novel/*.md`: All MD files in the novel directory
  - `content/blog/**/*.md`: All MD files in blog directory and its subdirectories

`formats` (Optional)

- List of output formats to generate
- Supported formats: docx, pdf, epub
- Default: docx
- Examples:
  - `formats: docx`
  - `formats: docx, pdf, epub`

`out.dir` (Optional)

- Directory where generated files will be placed
- Can use variables:
  - `${content}`: Expands to the directory of the source files
- Default: `${content}/out`

`template` (Optional)

- Templates for different output formats
- Specify per format
- Example:

```yaml
template:
  docx: templates/novel.docx
  pdf: templates/novel.latex
  epub: templates/novel.epub
```

`out.filename` (Optional)

- Template for generated filenames
- Available variables:
  - `${name}`: Document name from configuration
  - `${date}`: Current date
  - `${version}`: Version number
  - `${format}`: Output format extension
- Default: `${name}.${format}`
- Example: `${name}-draft-${date}`

## Shorthand Syntax

For simple cases, you can use a shorthand syntax where you specify just the content pattern:

```yaml
Quick Notes: content/notes/*.md  # Uses default settings
```

### Additional Fields

`options` (Optional)

- Command-line options passed to external tools (e.g., pandoc)
- Can be specified per format
- Example:

```yaml
options:
  docx: --toc --toc-depth=2
  pdf: --pdf-engine=xelatex
```

## Complete Example

```yaml
Default:
  formats: docx
  output: ${content}/out
  template:
    docx: templates/default.docx
    pdf: templates/default.latex
  filename: ${name}-${date}
  options:
    docx: --toc
    pdf: --pdf-engine=xelatex

My Novel:
  type: document  # default type
  content: content/novel/*.md
  formats: docx, epub
  output: content/novel/out
  template:
    docx: templates/novel.docx
    epub: templates/novel.epub
  filename: ${name}-draft-${date}
  options:
    docx: --toc --toc-depth=2
    epub: --toc --toc-depth=1

Quick Notes: content/notes/*.md  # Uses default settings

Blog Posts:
  type: individual
  content: content/blog/posts/**/*.md
  formats: pdf
  output: ${content}
  template:
    pdf: templates/blog.latex
  filename: post-${date}

Articles:
  type: individual
  content: content/articles/**/*.md
  formats: docx, pdf
  output: content/articles/out
  options:
    docx: --reference-doc=templates/article.docx
```

## File Organization

The extension assumes chapters/content are ordered by filename. A recommended naming scheme is to prefix files with numbers:

```
100_chapter_one.md
110_chapter_two.md
120_chapter_three.md
```

This ensures correct ordering in file explorers and when combining files for export. Numbers can be used with increments (e.g., 10) to allow inserting new chapters (e.g., `105_new_chapter.md`).
