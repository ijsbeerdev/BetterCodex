---
name: show-blackbox-info
description: Show the installed Blackbox plugin version and repository link in a compact, cozy information card. Use when the user asks about Blackbox, its version, its source code, its repository, or whether it is installed.
---

# Show Blackbox Info

Read `../../.codex-plugin/plugin.json` and use its current `version`, `description`, and `repository` values.

Respond with only a compact Markdown card in this shape:

```markdown
### Blackbox

**Version** <version><br>
**Repository** [ijsbeerdev/blackbox](<repository>)

<description>
```

Do not invent update status, installation dates, or capabilities that are absent from the manifest.
