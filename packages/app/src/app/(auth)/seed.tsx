import {
  EventType,
  generateUniqueID,
  TaskContentType,
  TaskIngestEvent,
  TaskSpecType,
} from "@withorbit/core";
import { styles } from "@withorbit/ui";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAuthenticationClient, useCurrentUserRecord } from "../../authentication/authContext.js";
import { neutral, NavButton } from "../../components/PageShared.js";
import { useDatabaseManager } from "../../hooks/useDatabaseManager.js";
import { parseQAMarkdown } from "../../model2/parseQAMarkdown.js";

const { gridUnit, edgeMargin, maximumContentWidth, borderRadius } =
  styles.layout;

export default function SeedPage() {
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();
  const authClient = useAuthenticationClient();
  const userRecord = useCurrentUserRecord(authClient);
  const databaseManager = useDatabaseManager(userRecord?.userID ?? null);

  async function handleSeed() {
    if (!databaseManager) return;
    const cards = parseQAMarkdown(markdown);
    if (cards.length === 0) {
      setStatus("No Q./A. pairs found.");
      return;
    }

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
    setStatus(`Seeded ${cards.length} card(s).`);
    setMarkdown("");
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
            Add Cards
          </Text>
          <View style={{ flexDirection: "row", gap: gridUnit }}>
            <NavButton label="All Cards" onPress={() => router.push("/cards")} />
            <NavButton label="Review" onPress={() => router.replace("/")} />
          </View>
        </View>

        <View style={{ paddingHorizontal: edgeMargin, flex: 1 }}>
          <Text
            style={[
              styles.type.runningTextSmall.typeStyle,
              { color: neutral.textSoft, marginBottom: gridUnit },
            ]}
          >
            Paste Q./A. pairs below:
          </Text>

          <TextInput
            value={markdown}
            onChangeText={setMarkdown}
            multiline
            placeholder={
              "Q. Your question here?\nA. Your answer here\n\nQ. Another question?\nA. Another answer"
            }
            placeholderTextColor={neutral.textSoft}
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              lineHeight: 20,
              padding: gridUnit * 2,
              borderRadius,
              backgroundColor: neutral.card,
              borderWidth: 1,
              borderColor: neutral.border,
              color: neutral.text,
              minHeight: 200,
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
            <NavButton label="Seed Cards" onPress={handleSeed} primary />
            {status && (
              <Text
                style={[
                  styles.type.runningTextSmall.typeStyle,
                  { color: neutral.textSoft },
                ]}
              >
                {status}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
