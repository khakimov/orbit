import { useEffect, useRef } from "react";
import { DatabaseManager } from "../model2/databaseManager.js";
import { supabase } from "../authentication/supabaseClient.js";

export function useDatabaseManager(
  userId: string | null,
): DatabaseManager | null {
  const dbRef = useRef<DatabaseManager | null>(null);

  useEffect(() => {
    if (!userId) return;

    dbRef.current = new DatabaseManager(userId, supabase);

    return () => {
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [userId]);

  return dbRef.current;
}
