import {
  EventType,
  generateUniqueID,
  QATaskContent,
  Task,
  TaskContentType,
  TaskID,
  TaskUpdateDeletedEvent,
} from "@withorbit/core";
import { styles } from "@withorbit/ui";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuthenticationClient, useCurrentUserRecord } from "../../authentication/authContext.js";
import { neutral, NavButton } from "../../components/PageShared.js";
import { useDatabaseManager } from "../../hooks/useDatabaseManager.js";

const { gridUnit, edgeMargin, maximumContentWidth, borderRadius } =
  styles.layout;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function CardRow({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[styles.type.labelTiny.typeStyle, { color: neutral.textSoft }]}>
          {isDue
            ? "Due now"
            : `Due ${formatDate(componentState?.dueTimestampMillis ?? 0)}`}
          {"  \u00B7  "}
          {componentState?.lastRepetitionTimestampMillis
            ? `Reviewed ${formatDate(componentState.lastRepetitionTimestampMillis)}`
            : "New"}
        </Text>
        <View style={{ flexDirection: "row", gap: gridUnit }}>
          <Pressable onPress={onEdit}>
            <Text style={[styles.type.labelTiny.typeStyle, { color: neutral.accent }]}>
              Edit
            </Text>
          </Pressable>
          <Pressable onPress={onDelete}>
            <Text style={[styles.type.labelTiny.typeStyle, { color: "#dc2626" }]}>
              Delete
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState<Task[] | null>(null);
  const router = useRouter();
  const authClient = useAuthenticationClient();
  const userRecord = useCurrentUserRecord(authClient);
  const databaseManager = useDatabaseManager(userRecord?.userID ?? null);

  const loadCards = useCallback(() => {
    databaseManager?.listAllCards().then(setCards);
  }, [databaseManager]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function handleDelete(taskId: TaskID) {
    if (!databaseManager) return;
    const event: TaskUpdateDeletedEvent = {
      id: generateUniqueID(),
      type: EventType.TaskUpdateDeleted,
      entityID: taskId,
      timestampMillis: Date.now(),
      isDeleted: true,
    };
    await databaseManager.recordEvents([event]);
    setCards((prev) => prev?.filter((c) => c.id !== taskId) ?? null);
  }

  function handleEdit(task: Task) {
    const content = task.spec.content;
    if (content.type !== TaskContentType.QA) return;
    const qa = content as QATaskContent;
    router.push({
      pathname: "/cards/add",
      params: {
        editId: task.id,
        editQuestion: qa.body.text,
        editAnswer: qa.answer.text,
      },
    });
  }

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
            <NavButton label="Add" onPress={() => router.push("/cards/add")} primary />
            <NavButton label="Review" onPress={() => router.replace("/")} />
          </View>
        </View>

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
            cards.map((task) => (
              <CardRow
                key={task.id}
                task={task}
                onEdit={() => handleEdit(task)}
                onDelete={() => handleDelete(task.id as TaskID)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
