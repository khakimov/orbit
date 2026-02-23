import { Event } from "@withorbit/core";
import { styles } from "@withorbit/ui";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAuthenticationClient, useCurrentUserRecord } from "../../authentication/authContext.js";
import { neutral, NavButton } from "../../components/PageShared.js";
import { useDatabaseManager } from "../../hooks/useDatabaseManager.js";

const { gridUnit, edgeMargin, maximumContentWidth, borderRadius } =
  styles.layout;

export default function ImportPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const router = useRouter();
  const authClient = useAuthenticationClient();
  const userRecord = useCurrentUserRecord(authClient);
  const databaseManager = useDatabaseManager(userRecord?.userID ?? null);

  async function handleImport() {
    if (!databaseManager) return;
    const authToken = token.trim();
    if (!authToken) {
      setStatus("Paste your ID token from the Authorization header.");
      return;
    }

    setImporting(true);
    setStatus("Fetching events...");

    try {
      const allEvents: Event[] = [];
      let afterID: string | null = null;

      while (true) {
        const url: string =
          "https://withorbit.com/api/events?limit=100" +
          (afterID ? `&afterID=${encodeURIComponent(afterID)}` : "");
        const resp: Response = await fetch(url, {
          headers: {
            Authorization: `ID ${authToken}`,
            Accept: "application/json",
          },
        });

        if (!resp.ok) {
          setStatus(`API error: ${resp.status}. The legacy API may be offline.`);
          setImporting(false);
          return;
        }

        const data: { items?: Event[]; hasMore?: boolean } = await resp.json();
        const items: Event[] = data.items || [];
        allEvents.push(...items);
        setStatus(`Fetched ${allEvents.length} events...`);

        if (!data.hasMore || items.length === 0) break;
        afterID = items[items.length - 1].id;
      }

      if (allEvents.length === 0) {
        setStatus("No events found on server.");
        setImporting(false);
        return;
      }

      setStatus(`Writing ${allEvents.length} events to local store...`);
      await databaseManager.recordEvents(allEvents);
      setStatus(
        `Imported ${allEvents.length} events. Go to All Cards to see them.`,
      );
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <View style={{ backgroundColor: neutral.bg, flex: 1 }}>
      <View
        style={{
          width: "100%",
          maxWidth: maximumContentWidth,
          alignSelf: "center",
          flex: 1,
        }}
      >
        <View
          style={{
            paddingHorizontal: edgeMargin,
            paddingTop: gridUnit * 3,
            paddingBottom: gridUnit * 2,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <Text
            style={[styles.type.headline.layoutStyle, { color: neutral.text }]}
          >
            Import from Orbit
          </Text>
          <View style={{ flexDirection: "row", gap: gridUnit }}>
            <NavButton
              label="All Cards"
              onPress={() => router.push("/cards")}
            />
            <NavButton label="Review" onPress={() => router.replace("/")} />
          </View>
        </View>

        <View style={{ paddingHorizontal: edgeMargin, flex: 1 }}>
          <Text
            style={[
              styles.type.runningTextSmall.typeStyle,
              { color: neutral.accent, marginBottom: gridUnit },
            ]}
          >
            Note: The legacy Orbit API may be offline. This page is for
            one-time migration of existing data.
          </Text>

          <Text
            style={[
              styles.type.runningTextSmall.typeStyle,
              { color: neutral.textSoft, marginBottom: gridUnit },
            ]}
          >
            Paste the ID token from your browser's Authorization header (the
            part after "ID "):
          </Text>

          <TextInput
            value={token}
            onChangeText={setToken}
            multiline
            placeholder="eyJhbGciOi..."
            placeholderTextColor={neutral.textSoft}
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              lineHeight: 18,
              padding: gridUnit * 2,
              borderRadius,
              backgroundColor: neutral.card,
              borderWidth: 1,
              borderColor: neutral.border,
              color: neutral.text,
              minHeight: 80,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: gridUnit * 2,
              marginTop: gridUnit * 2,
            }}
          >
            <NavButton
              label={importing ? "Importing..." : "Import All Events"}
              onPress={handleImport}
              primary
            />
          </View>

          {status && (
            <Text
              style={[
                styles.type.runningTextSmall.typeStyle,
                { color: neutral.textSoft, marginTop: gridUnit * 2 },
              ]}
            >
              {status}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
