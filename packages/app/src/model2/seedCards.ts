import {
  EventType,
  generateUniqueID,
  TaskContentType,
  TaskIngestEvent,
  TaskSpecType,
} from "@withorbit/core";
import { DatabaseManager } from "./databaseManager.js";

interface CardSpec {
  question: string;
  answer: string;
}

export async function seedCards(
  databaseManager: DatabaseManager,
  cards: CardSpec[],
): Promise<void> {
  const events: TaskIngestEvent[] = cards.map((card) => ({
    id: generateUniqueID(),
    type: EventType.TaskIngest as const,
    entityID: generateUniqueID(),
    timestampMillis: Date.now(),
    spec: {
      type: TaskSpecType.Memory,
      content: {
        type: TaskContentType.QA,
        body: { text: card.question, attachments: [] },
        answer: { text: card.answer, attachments: [] },
      },
    },
    provenance: null,
  }));
  await databaseManager.recordEvents(events);
}
