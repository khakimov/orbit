import {
  EventType,
  generateUniqueID,
  TaskContentType,
  TaskIngestEvent,
  TaskSpecType,
} from "@withorbit/core";
import { styles } from "@withorbit/ui";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { parseQAMarkdown } from "../../model2/parseQAMarkdown.js";
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

export default function SeedPage() {
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const dbRef = useRef<DatabaseManager | null>(null);
  const router = useRouter();

  if (!dbRef.current) {
    dbRef.current = new DatabaseManager();
  }

  async function handleSeed() {
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

    await dbRef.current!.recordEvents(events);
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
        {/* Header — same structure as /cards */}
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

        {/* Content */}
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
