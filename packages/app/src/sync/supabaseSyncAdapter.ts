import { Event } from "@withorbit/core";
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
  async pullEvents(
    lastSyncAt: string | null,
  ): Promise<{ events: Event[]; latestCreatedAt: string | null }> {
    const query = this._supabase
      .from("events")
      .select("data, created_at")
      .order("created_at", { ascending: true });

    if (lastSyncAt) {
      query.gt("created_at", lastSyncAt);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Sync] Pull failed:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      return { events: [], latestCreatedAt: null };
    }

    const events = data.map((row) => row.data as Event);
    const latestCreatedAt = data[data.length - 1].created_at as string;

    return { events, latestCreatedAt };
  }
}
