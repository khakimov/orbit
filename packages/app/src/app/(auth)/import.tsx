import { Event } from "@withorbit/core";
import { styles } from "@withorbit/ui";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DatabaseManager } from "../../model2/databaseManager.js";

const { gridUnit, edgeMargin, maximumContentWidth, borderRadius } =
  styles.layout;

const neutral = {
  bg: "#f5f5f4",
  card: "#ffffff",
  border: "#e5e5e4",
  text: styles.colors.ink,
  textSoft: "rgba(0,0,0,0.45)",
  accent: styles.colors.productKeyColor,
};

function NavButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: primary ? neutral.accent : neutral.card,
        borderWidth: primary ? 0 : 1,
        borderColor: neutral.border,
        paddingHorizontal: gridUnit * 2,
        paddingVertical: gridUnit,
        borderRadius,
      }}
    >
      <Text
        style={[
          styles.type.labelSmall.typeStyle,
          { color: primary ? "#fff" : neutral.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ImportPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const dbRef = useRef<DatabaseManager | null>(null);
  const router = useRouter();

  if (!dbRef.current) {
    dbRef.current = new DatabaseManager();
  }

  async function handleImport() {
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
        const url =
          "https://withorbit.com/api/events?limit=100" +
          (afterID ? `&afterID=${afterID}` : "");
        const resp = await fetch(url, {
          headers: {
            Authorization: `ID ${authToken}`,
            Accept: "application/json",
          },
        });

        if (!resp.ok) {
          setStatus(`API error: ${resp.status}. Token may be expired.`);
          setImporting(false);
          return;
        }

        const data = await resp.json();
        const items = data.items || [];
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
      await dbRef.current!.recordEvents(allEvents);
      setStatus(
        `Imported ${allEvents.length} events. Go to All Cards to see them.`,
      );
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
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
        {/* Header */}
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

        {/* Content */}
        <View style={{ paddingHorizontal: edgeMargin, flex: 1 }}>
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
