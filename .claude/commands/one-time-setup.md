# One-time Setup Instructions

How to set this project up from scratch.
Run these instructions only once when you need to set up the repository and build the implementation plan.

## Setup Process

0. Read all `.claude/rules/` to understand guidelines and project structure.
1. Install dependencies: `bun install` from root.
2. Build the project: `bun run build` (TypeScript compilation).
3. Run tests to verify: `bun run test:unit` (run from root).
4. Start the web dev server: `cd packages/app && bun run web` — verify it loads on http://localhost:19006.
5. Read existing `docs/` and `specs/` (if present) for project context.
6. If implementing a new feature: read relevant packages, then create a phased implementation plan in `journal/YYYY-MM-DD_implementation_plan.md`.
7. Document key design choices in `journal/YYYY-MM-DD_key_design_choices.md`.
8. Do not start implementation until explicitly told so.
