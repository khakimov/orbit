import { AttachmentID, AttachmentMIMEType, Event } from "@withorbit/core";
import { SupabaseClient } from "@supabase/supabase-js";

interface EventRow {
  id: string;
  user_id: string;
  entity_id: string;
  type: string;
  timestamp_millis: number;
  data: Event;
  created_at: string;
}

export class SupabaseSyncAdapter {
  private _supabase: SupabaseClient;
  private _userId: string;

  constructor(supabase: SupabaseClient, userId: string) {
    this._supabase = supabase;
    this._userId = userId;
  }

  // Push events to Supabase. Upserts with ON CONFLICT DO NOTHING
  // so duplicate event IDs are silently ignored.
  async pushEvents(events: Event[]): Promise<void> {
    if (events.length === 0) return;

    const rows: Omit<EventRow, "created_at">[] = events.map((e) => ({
      id: e.id,
      user_id: this._userId,
      entity_id: e.entityID,
      type: e.type,
      timestamp_millis: e.timestampMillis,
      data: e,
    }));

    const { error } = await this._supabase
      .from("events")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      console.error("[Sync] Push failed:", error);
      throw error;
    }
  }

  // Pull events from Supabase newer than lastSyncAt.
  // Returns the events and the created_at of the latest one (for cursor).
  // Paginates in batches of PAGE_SIZE to avoid Supabase's default 1000-row cap.
  async pullEvents(
    lastSyncAt: string | null,
  ): Promise<{ events: Event[]; latestCreatedAt: string | null }> {
    const PAGE_SIZE = 1000;
    const allEvents: Event[] = [];
    let cursor = lastSyncAt;

    for (;;) {
      const query = this._supabase
        .from("events")
        .select("data, created_at")
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);

      if (cursor) {
        query.gt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[Sync] Pull failed:", error);
        throw error;
      }

      if (!data || data.length === 0) break;

      allEvents.push(...data.map((row) => row.data as Event));
      cursor = data[data.length - 1].created_at as string;

      if (data.length < PAGE_SIZE) break;
    }

    return {
      events: allEvents,
      latestCreatedAt: cursor !== lastSyncAt ? cursor : null,
    };
  }

  // Upload attachment bytes to Supabase Storage.
  // Skips if the file already exists (upsert: false).
  async pushAttachment(
    id: AttachmentID,
    contents: Uint8Array,
    mimeType: AttachmentMIMEType,
  ): Promise<void> {
    const path = `${this._userId}/${id}`;
    const { error } = await this._supabase.storage
      .from("attachments")
      .upload(path, contents, { contentType: mimeType, upsert: false });

    // "Duplicate" / 409 means it already exists — that's fine.
    // Also handle 400 (Duplicate) which Supabase may return.
    const statusCode = (error as any)?.statusCode;
    const isDuplicate = statusCode === 409 || statusCode === 400 || 
                        error?.message?.toLowerCase().includes("duplicate");
    if (error && !isDuplicate) {
      console.error("[Sync] Attachment push failed:", error);
      throw error;
    }
  }

  // Download attachment bytes from Supabase Storage.
  // Returns null if not found.
  async pullAttachment(
    id: AttachmentID,
  ): Promise<{ contents: Uint8Array; mimeType: AttachmentMIMEType } | null> {
    const path = `${this._userId}/${id}`;
    const { data, error } = await this._supabase.storage
      .from("attachments")
      .download(path);

    if (error) {
      // 404 / "not found" is expected when attachment hasn't been uploaded.
      if ((error as any).statusCode === 404 || error.message?.includes("not found")) {
        return null;
      }
      console.error("[Sync] Attachment pull failed:", error);
      throw error;
    }

    if (!data) return null;

    const contents = new Uint8Array(await data.arrayBuffer());
    const rawType = data.type || "image/png";
    
    // Use the raw MIME type if it's a valid image/* type, otherwise fall back to PNG.
    // This preserves types like image/webp that aren't in the enum but are valid.
    const mimeType = rawType.startsWith("image/")
      ? (rawType as AttachmentMIMEType)
      : AttachmentMIMEType.PNG;

    return { contents, mimeType };
  }
}
