---
description: Markdown documentation standards and style guidelines
globs: "**/*.md"
alwaysApply: false
---
# Markdown and Documentation Standards
Write concise documentation. Keep it simple and readable in a plain text editor.

- Headers (max level 4).
- Lists, code blocks, inline code.
- NEVER use **bold**:
    - **`something`** -> `something`
    - **something** -> `something` or *something* (if backticks create ambiguity)
    - **Topic:** description -> Topic: description
        (also check for tautology in topic/description)
    - **Subheader:** -> elevate to `#### Subheader`
- Simple tables; prefer simple lists to table.
- Diagrams: Include both ASCII and Mermaid versions.
- Code docs: concise, no filler.
