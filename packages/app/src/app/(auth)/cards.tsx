import { QATaskContent, Task, TaskContentType } from "@withorbit/core";
import { styles } from "@withorbit/ui";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function CardRow({ task }: { task: Task }) {
  const content = task.spec.content;
  const componentState = Object.values(task.componentStates)[0];
  const isDue = componentState
    ? componentState.dueTimestampMillis <= Date.now()
    : false;

  let question = "";
  let answer = "";
  if (content.type === TaskContentType.QA) {
    const qa = content as QATaskContent;
    question = qa.body.text;
    answer = qa.answer.text;
  } else if (content.type === TaskContentType.Cloze) {
    question = content.body.text;
    answer = "(cloze)";
  }

  return (
    <View
      style={{
        backgroundColor: neutral.card,
        borderRadius,
        borderWidth: 1,
        borderColor: neutral.border,
        padding: gridUnit * 2,
        marginBottom: gridUnit,
      }}
    >
      <Text style={[styles.type.promptSmall.typeStyle, { color: neutral.text }]}>
        {question}
      </Text>
      <View style={{ height: gridUnit / 2 }} />
      <Text
        style={[styles.type.runningTextSmall.typeStyle, { color: neutral.textSoft }]}
      >
        {answer}
      </Text>
      <View style={{ height: gridUnit }} />
      <Text style={[styles.type.labelTiny.typeStyle, { color: neutral.textSoft }]}>
        {isDue
          ? "Due now"
          : `Due ${formatDate(componentState?.dueTimestampMillis ?? 0)}`}
        {"  ·  "}
        {componentState?.lastRepetitionTimestampMillis
          ? `Reviewed ${formatDate(componentState.lastRepetitionTimestampMillis)}`
          : "New"}
      </Text>
    </View>
  );
}

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

export default function CardsPage() {
  const [cards, setCards] = useState<Task[] | null>(null);
  const dbRef = useRef<DatabaseManager | null>(null);
  const router = useRouter();

  if (!dbRef.current) {
    dbRef.current = new DatabaseManager();
  }

  useEffect(() => {
    dbRef.current!.listAllCards().then(setCards);
  }, []);

  const dueCount = cards?.filter(
    (c) =>
      Object.values(c.componentStates)[0]?.dueTimestampMillis <= Date.now(),
  ).length;

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
          <View>
            <Text style={[styles.type.headline.layoutStyle, { color: neutral.text }]}>
              {cards ? `${cards.length} Cards` : "Cards"}
            </Text>
            {dueCount !== undefined && dueCount > 0 && (
              <Text
                style={[
                  styles.type.labelSmall.typeStyle,
                  { color: neutral.accent, marginTop: gridUnit / 2 },
                ]}
              >
                {dueCount} due now
              </Text>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: gridUnit }}>
            <NavButton label="Add" onPress={() => router.push("/seed")} primary />
            <NavButton label="Review" onPress={() => router.replace("/")} />
          </View>
        </View>

        {/* Card list */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: edgeMargin,
            paddingBottom: gridUnit * 4,
          }}
        >
          {cards === null ? (
            <Text
              style={[
                styles.type.runningText.typeStyle,
                { paddingTop: gridUnit * 2, color: neutral.textSoft },
              ]}
            >
              Loading...
            </Text>
          ) : cards.length === 0 ? (
            <Text
              style={[
                styles.type.runningText.typeStyle,
                { paddingTop: gridUnit * 2, color: neutral.textSoft },
              ]}
            >
              No cards yet. Tap "Add" to seed some.
            </Text>
          ) : (
            cards.map((task) => <CardRow key={task.id} task={task} />)
          )}
        </ScrollView>
      </View>
    </View>
  );
}
