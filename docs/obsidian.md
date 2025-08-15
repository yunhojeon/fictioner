## **Obsidian Compatibility**

[ChatGPT Conversation](https://chatgpt.com/c/689eb33c-8d10-832e-9995-550ea501c3a0)

* **Tag format:** Use normal inline hashtags in Markdown (not HTML comments) so Obsidian indexes them.
* **Semantic tag identification:** Use trailing punctuation (`! ? ~`) to mark semantic status (`raised?`, `resolved!`, `recurring~`, etc.).
* **Core parser:** Won’t modify Obsidian’s hashtag rules; will build a plugin to read `metadataCache.tags` positions and detect trailing punctuation.
* **Publishing tags:** No special separation inside Obsidian — semantic tags will appear alongside other tags in the Tag pane.
* **DOCX export:** Use Pandoc Lua filter to remove semantic tags (or modifiers) during `.docx` generation.
* **Web publishing:** Use Hugo **Option A** — run `replaceRE` on `.Content` in relevant templates to strip semantic tags from final HTML in `public/`.
* **Future expansion:** If site grows complex (RSS, summaries, search indexes), consider Option B (preprocessing content before Hugo).

---

## **To-do list**

**Obsidian plugin**

* [ ] Hook into `metadataCache.on('resolved')` and `metadataCache.on('changed')`.
* [ ] From `cache.tags`, get tag positions and check trailing char from source text.
* [ ] Build internal index: `{ file, pos, baseTag, modifierChar }`.
* [ ] (Optional) Add preview/source decorations for semantic tags.
* [ ] Add search/filter UI for semantic tags.

**Pandoc**

* [ ] Implement Lua filter to:

  * Match semantic tags by regex (e.g., `^#.*[!?~]$` or `^#sem/…`).
  * Remove them (and optional preceding space) in `.docx` output.

**Hugo**

* [ ] In `layouts/_default/single.html` (and any other relevant templates):

  ```go-html-template
  {{ $body := .Content | replaceRE `(^|[[:space:]])#sem/[A-Za-z0-9/_-]+[!?~]?` `$1` }}
  {{ $body | safeHTML }}
  ```

  * Adjust regex to match your semantic tag pattern.
* [ ] Repeat the `replaceRE` in RSS template if you use `.Content` there.
* [ ] Test a build and verify `public/` HTML has no semantic tags.

**Testing**

* [ ] Confirm Obsidian indexes tags without punctuation.
* [ ] Confirm plugin detects modifiers correctly.
* [ ] Confirm Pandoc export omits semantic tags.
* [ ] Confirm Hugo site builds without semantic tags in `public/`.

---

Do you want me to also draft the **exact regex** that will match both `#sem/...` *and* your `#tag!`/`#tag?`/`#tag~` form so you can use the same pattern in both the Hugo template and the Pandoc Lua filter? That way you won’t have two slightly different versions drifting apart.
