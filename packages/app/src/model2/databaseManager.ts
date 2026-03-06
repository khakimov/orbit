import { SupabaseClient } from "@supabase/supabase-js";
import {
  AttachmentID,
  AttachmentMIMEType,
  createReviewQueue,
  EntityType,
  Event,
  getReviewQueueFuzzyDueTimestampThreshold,
  ReviewItem,
  Task,
} from "@withorbit/core";
import { OrbitStore } from "@withorbit/store-shared";
import { SupabaseSyncAdapter } from "../sync/supabaseSyncAdapter.js";
import { createOrbitStore } from "./orbitStoreFactory.js";

const LAST_SYNC_KEY = "supabase_last_sync_at";
const BUILD_VERSION = "2026-02-26a";

export class DatabaseManager {
  private readonly _storePromise: Promise<OrbitStore>;
  private readonly _syncAdapter: SupabaseSyncAdapter | null;
  private _pullPromise: Promise<void> | null = null;
  private readonly _pendingAttachmentFetches = new Set<AttachmentID>();
  private readonly _failedAttachmentFetches = new Set<AttachmentID>();

  constructor(userId: string, supabase?: SupabaseClient) {
    this._storePromise = createOrbitStore(`orbitStore.${userId}`);

    if (supabase) {
      this._syncAdapter = new SupabaseSyncAdapter(supabase, userId);
      this._pullPromise = this._pullFromRemote();
    } else {
      this._syncAdapter = null;
    }
  }

  async fetchReviewQueue(): Promise<ReviewItem[]> {
    // Wait for initial pull to complete before building the queue.
    await this._pullPromise;

    const store = await this._storePromise;
    const thresholdTimestampMillis = getReviewQueueFuzzyDueTimestampThreshold();

    const dueTasks = await store.database.listEntities<Task>({
      entityType: EntityType.Task,
      limit: 500,
      predicate: ["dueTimestampMillis", "<=", thresholdTimestampMillis],
    });
    return createReviewQueue(dueTasks);
  }

  async close(): Promise<void> {
    const store = await this._storePromise;
    await store.database.close();
  }

  async recordEvents(events: Event[]): Promise<void> {
    // Always write locally first.
    const store = await this._storePromise;
    await store.database.putEvents(events);

    // Fire-and-forget push to Supabase.
    if (this._syncAdapter) {
      this._syncAdapter.pushEvents(events).catch((error) => {
        console.error("[Sync] Push failed:", error);
      });
    }
  }

  async listAllCards(): Promise<Task[]> {
    const store = await this._storePromise;
    return store.database.listEntities<Task>({
      entityType: EntityType.Task,
      limit: 1000,
      predicate: ["dueTimestampMillis", "<=", Number.MAX_SAFE_INTEGER],
    });
  }

  async storeAttachment(
    contents: Uint8Array,
    id: AttachmentID,
    mimeType: AttachmentMIMEType,
  ): Promise<void> {
    const store = await this._storePromise;
    await store.attachmentStore.storeAttachment(contents, id, mimeType);

    // Fire-and-forget push to Supabase Storage.
    if (this._syncAdapter) {
      this._syncAdapter.pushAttachment(id, contents, mimeType).catch((error) => {
        console.error("[Sync] Attachment push failed:", error);
      });
    }
  }

  async getURLForAttachmentID(
    attachmentID: AttachmentID,
  ): Promise<{ url: string; mimeType: AttachmentMIMEType } | null> {
    const store = await this._storePromise;
    const localURL =
      await store.attachmentStore.getURLForStoredAttachment(attachmentID);
    if (localURL) {
      const { type } = await store.attachmentStore.getAttachment(attachmentID);
      return { url: localURL, mimeType: type };
    }

    // Not found locally — fetch from Supabase and wait.
    const fetched = await this._fetchAndCacheAttachment(attachmentID);
    if (fetched) {
      const cachedURL =
        await store.attachmentStore.getURLForStoredAttachment(attachmentID);
      if (cachedURL) {
        return { url: cachedURL, mimeType: fetched.mimeType };
      }
    }
    return null;
  }

  private async _fetchAndCacheAttachment(
    id: AttachmentID,
  ): Promise<{ mimeType: AttachmentMIMEType } | null> {
    if (!this._syncAdapter) return null;
    if (this._pendingAttachmentFetches.has(id)) return null;
    if (this._failedAttachmentFetches.has(id)) return null;
    this._pendingAttachmentFetches.add(id);

    try {
      const result = await this._syncAdapter.pullAttachment(id);
      if (!result) {
        this._failedAttachmentFetches.add(id);
        return null;
      }
      const store = await this._storePromise;
      await store.attachmentStore.storeAttachment(
        result.contents,
        id,
        result.mimeType,
      );
      console.info("[Sync] Cached attachment from remote:", id);
      return { mimeType: result.mimeType };
    } catch (error) {
      console.error("[Sync] Attachment fetch failed:", error);
      return null;
    } finally {
      this._pendingAttachmentFetches.delete(id);
    }
  }

  private async _pullFromRemote(): Promise<void> {
    if (!this._syncAdapter) return;

    try {
      const store = await this._storePromise;
      const lastSyncAt = await store.database.getMetadataValues([
        LAST_SYNC_KEY,
      ]);
      const cursor = lastSyncAt.get(LAST_SYNC_KEY) ?? null;

      console.info(`[Sync][${BUILD_VERSION}] Pulling events since:`, cursor ?? "beginning");
      const { events, latestCreatedAt } =
        await this._syncAdapter.pullEvents(cursor);

      if (events.length > 0) {
        await store.database.putEvents(events);
        console.info(`[Sync][${BUILD_VERSION}] Pulled ${events.length} events.`);
      }

      if (latestCreatedAt) {
        await store.database.setMetadataValues(
          new Map([[LAST_SYNC_KEY, latestCreatedAt]]),
        );
      }
    } catch (error) {
      // Pull failure is non-fatal: we proceed with local data.
      // No retry for MVP — next app load will attempt again.
      console.error(`[Sync][${BUILD_VERSION}] Pull failed:`, error);
    }
  }
}
