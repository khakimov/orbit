---
description: TypeScript and React Native coding standards
globs: "**/*.{ts,tsx}"
alwaysApply: false
---
# TypeScript Standards

- TypeScript strict mode, use type annotations where they add clarity
- Prefer `interface` over `type` for object shapes
- Use `.js` extensions in imports (ESM resolution)
- Async/await over raw Promises
- Credentials in `.env`, never committed
- Monorepo packages reference each other via workspace protocol (`"0.0.1"` in package.json)
- Do not use emoji in code; unicode symbols are fine
- Follow existing patterns in the codebase before introducing new ones
