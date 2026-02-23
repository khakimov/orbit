# Seeding Cards into Orbit

Orbit stores all data locally (IndexedDB on web, SQLite on native). Cards are created by writing `TaskIngestEvent` events to the store. There is no separate "create task" API — tasks emerge as projections of the event stream.

## Quick: The `/seed` page (web)

Navigate to `/seed` in the app. Paste Q./A. markdown and click "Seed Cards":

```
Q. What's the ratio of chicken bones to water in chicken stock?
A. A quart of water per pound of bones

Q. At what temperature should you simmer stock?
A. Around 200°F / just below a simmer
```

Format rules:
- Each card starts with `Q. ` followed by the question text
- Answer starts with `A. ` on the next non-blank line
- Separate multiple cards with blank lines
- Multi-line questions/answers are supported (lines without Q./A. prefix continue the previous block)

## Programmatic: `seedCards()` utility

From app code, use `packages/app/src/model2/seedCards.ts`:

```typescript
import { DatabaseManager } from "./databaseManager.js";
import { seedCards } from "./seedCards.js";

const dm = new DatabaseManager(); // no args = local-only, no sync
await seedCards(dm, [
  {
    question: "What's the ratio of chicken bones to water?",
    answer: "A quart of water per pound of bones",
  },
]);
```

## CLI: interpreter + ingester pipeline (native/SQLite)

The full pipeline parses Markdown files with Q./A. syntax and writes to a local SQLite store. This is the original authoring workflow.

### Step 1: Interpret Markdown to JSON

```bash
cd packages/interpreter
bun run interpret /path/to/notes/ /path/to/output.json
```

Input markdown files use the same `Q. / A.` format. The interpreter also supports cloze deletions with `{curly braces}`.

### Step 2: Ingest JSON into local store

```bash
cd packages/ingester
bun run ingest /path/to/orbit-store /path/to/output.json
```

The ingester diffs against the existing store, so re-running is safe — it only emits events for new/changed/deleted cards.

### Ingestible JSON format

You can also write the JSON directly and skip the interpreter:

```json
{
  "sources": [
    {
      "identifier": "my-source-id",
      "title": "My Notes",
      "items": [
        {
          "identifier": "unique-item-id",
          "spec": {
            "type": "memory",
            "content": {
              "type": "qa",
              "body": { "text": "Question?", "attachments": [] },
              "answer": { "text": "Answer.", "attachments": [] }
            }
          }
        }
      ]
    }
  ]
}
```

## Low-level: raw `TaskIngestEvent`

The atomic unit across all paths is a `TaskIngestEvent`:

```typescript
import {
  EventType,
  generateUniqueID,
  TaskContentType,
  TaskIngestEvent,
  TaskSpecType,
} from "@withorbit/core";

const event: TaskIngestEvent = {
  id: generateUniqueID(),           // 22-char base64 UUID
  type: EventType.TaskIngest,
  entityID: generateUniqueID(),     // becomes the TaskID
  timestampMillis: Date.now(),
  spec: {
    type: TaskSpecType.Memory,
    content: {
      type: TaskContentType.QA,
      body: { text: "Question?", attachments: [] },
      answer: { text: "Answer.", attachments: [] },
    },
  },
  provenance: null,                 // or { identifier, title, url, colorPaletteName }
};

// Write to store:
await store.database.putEvents([event]);
// Or via DatabaseManager:
await databaseManager.recordEvents([event]);
```

Key details:
- IDs are UUIDv4 encoded as 22-char web-safe base64 (pattern: `^[0-9a-zA-Z_\-]{22}$`)
- Use `generateUniqueID()` from `@withorbit/core` for both event and entity IDs
- If you ingest with the same `entityID` twice, the second ingest updates provenance/metadata but keeps existing spec and review history
- QA tasks have a single component `"main"`; cloze tasks have one component per deletion
- The `provenance.identifier` field clusters related tasks (e.g. all cards from one article)
