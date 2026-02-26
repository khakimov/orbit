import {
  AttachmentID,
  AttachmentIngestEvent,
  AttachmentMIMEType,
  EventType,
  generateUniqueID,
  TaskContentField,
  TaskContentType,
  TaskID,
  TaskIngestEvent,
  TaskSpecType,
  TaskUpdateSpecEvent,
} from "@withorbit/core";
import { PromptFieldRenderer, styles } from "@withorbit/ui";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  useAuthenticationClient,
  useCurrentUserRecord,
} from "../../../authentication/authContext.js";
import { neutral, NavButton } from "../../../components/PageShared.js";
import { useDatabaseManager } from "../../../hooks/useDatabaseManager.js";
import { supabase } from "../../../authentication/supabaseClient.js";
import { ContextSection } from "./ContextSection.js";

interface CardReview {
  verdict: "good" | "needs_work" | "poor";
  summary: string;
  issues: Array<{
    category: "clarity" | "ambiguity" | "completeness" | "accuracy" | "formatting";
    description: string;
    suggestion: string;
  }>;
  rewrite?: {
    question?: string;
    answer?: string;
  };
}

const verdictColors: Record<CardReview["verdict"], string> = {
  good: "#16a34a",
  needs_work: "#ca8a04",
  poor: "#dc2626",
};

const verdictLabels: Record<CardReview["verdict"], string> = {
  good: "Good",
  needs_work: "Needs work",
  poor: "Poor",
};

const { gridUnit, edgeMargin, maximumContentWidth, borderRadius } =
  styles.layout;

interface PickedImage {
  uri: string;
  mimeType: AttachmentMIMEType;
}

function mimeTypeFromPicker(raw: string | undefined | null): AttachmentMIMEType | null {
  switch (raw) {
    case "image/png":
      return AttachmentMIMEType.PNG;
    case "image/jpeg":
      return AttachmentMIMEType.JPEG;
    case "image/svg+xml":
      return AttachmentMIMEType.SVG;
    default:
      return null;
  }
}

async function fetchImageBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export default function AddCardPage() {
  const params = useLocalSearchParams<{
    editId?: string;
    editQuestion?: string;
    editAnswer?: string;
  }>();
  const editId = params.editId as TaskID | undefined;

  const [question, setQuestion] = useState(params.editQuestion ?? "");
  const [answer, setAnswer] = useState(params.editAnswer ?? "");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  function showToast(message: string, duration = 2000) {
    setToast(message);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<CardReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [contextPinned, setContextPinned] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePinned, setSourcePinned] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<Array<{ id: string; question: string; answer: string }>>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Load pinned context from localStorage on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const saved = localStorage.getItem("orbit:pinned-context");
      if (saved) {
        setContext(saved);
        setContextPinned(true);
      }
    } catch {}
  }, []);

  // Load pinned source from localStorage on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const saved = localStorage.getItem("orbit:pinned-source");
      if (saved) {
        const parsed = JSON.parse(saved) as { title?: string; url?: string };
        if (parsed.title) setSourceTitle(parsed.title);
        if (parsed.url) setSourceUrl(parsed.url);
        setSourcePinned(true);
      }
    } catch (e) {
      console.warn("Failed to load pinned source:", e);
      localStorage.removeItem("orbit:pinned-source");
    }
  }, []);

  // Warn before navigating away with unsaved content
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const hasUnsaved = question.trim().length > 0 || answer.trim().length > 0;
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [question, answer]);

  const router = useRouter();
  const authClient = useAuthenticationClient();
  const userRecord = useCurrentUserRecord(authClient);
  const databaseManager = useDatabaseManager(userRecord?.userID ?? null);

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const mime = mimeTypeFromPicker(asset.mimeType);
    if (!mime) {
      showToast("Unsupported image type. Use PNG, JPEG, or SVG.", 3000);
      return;
    }
    setImage({ uri: asset.uri, mimeType: mime });
  }

  const canReview = useMemo(
    () => question.trim().length > 0 && answer.trim().length > 0,
    [question, answer],
  );

  async function handleReview() {
    if (!canReview) return;
    setReviewing(true);
    setReview(null);
    setReviewError(null);

    try {
      const { data, error } = await supabase.functions.invoke("review-card", {
        body: {
          question: question.trim(),
          answer: answer.trim(),
          context: context.trim() || undefined,
        },
      });

      if (error) {
        setReviewError(error.message ?? "Review failed");
        return;
      }

      setReview(data as CardReview);
    } catch (err) {
      console.error("Review error:", err);
      setReviewError("Review request failed");
    } finally {
      setReviewing(false);
    }
  }

  const canGenerate = useMemo(
    () => context.trim().length > 0,
    [context],
  );

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setGeneratedCards([]);
    setGenerateError(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-cards", {
        body: {
          context: context.trim(),
          sourceTitle: sourceTitle.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
        },
      });

      if (error) {
        setGenerateError(error.message ?? "Generation failed");
        return;
      }

      const cards = (data as { cards: Array<{ question: string; answer: string }> }).cards;
      if (!Array.isArray(cards) || cards.length === 0) {
        setGenerateError("No cards generated");
        return;
      }
      setGeneratedCards(cards.map((c, i) => ({ ...c, id: `gen-${Date.now()}-${i}` })));
    } catch (err) {
      console.error("Generate error:", err);
      setGenerateError("Generation request failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddGeneratedCard(index: number) {
    if (!databaseManager) return;
    const card = generatedCards[index];
    if (!card) return;

    const taskIngestEvent: TaskIngestEvent = {
      id: generateUniqueID(),
      type: EventType.TaskIngest as const,
      entityID: generateUniqueID<TaskID>(),
      timestampMillis: Date.now(),
      spec: {
        type: TaskSpecType.Memory as const,
        content: {
          type: TaskContentType.QA as const,
          body: { text: card.question, attachments: [] as AttachmentID[] },
          answer: { text: card.answer, attachments: [] as AttachmentID[] },
        },
      },
      provenance: sourceTitle.trim() || sourceUrl.trim()
        ? {
            identifier: sourceUrl.trim() || `source:${sourceTitle.trim().toLowerCase().replace(/\s+/g, "-")}`,
            ...(sourceUrl.trim() ? { url: sourceUrl.trim() } : {}),
            ...(sourceTitle.trim() ? { title: sourceTitle.trim() } : {}),
          }
        : null,
    };

    await databaseManager.recordEvents([taskIngestEvent]);
    setGeneratedCards((prev) => prev.filter((_, i) => i !== index));
    showToast("Added!");
  }

  async function handleSave() {
    if (!databaseManager) return;
    if (!question.trim() || !answer.trim()) {
      showToast("Both question and answer are required.", 3000);
      return;
    }

    setSaving(true);

    try {
      const events: (TaskIngestEvent | AttachmentIngestEvent | TaskUpdateSpecEvent)[] = [];
      const attachments: AttachmentID[] = [];

      if (image) {
        const attachmentID = generateUniqueID() as AttachmentID;
        const bytes = await fetchImageBytes(image.uri);
        await databaseManager.storeAttachment(bytes, attachmentID, image.mimeType);

        events.push({
          id: generateUniqueID(),
          type: EventType.AttachmentIngest as const,
          entityID: attachmentID,
          timestampMillis: Date.now(),
          mimeType: image.mimeType,
        });
        attachments.push(attachmentID);
      }

      const spec = {
        type: TaskSpecType.Memory as const,
        content: {
          type: TaskContentType.QA as const,
          body: { text: question.trim(), attachments },
          answer: { text: answer.trim(), attachments: [] as AttachmentID[] },
        },
      };

      if (editId) {
        const updateEvent: TaskUpdateSpecEvent = {
          id: generateUniqueID(),
          type: EventType.TaskUpdateSpecEvent,
          entityID: editId,
          timestampMillis: Date.now(),
          spec,
        };
        events.push(updateEvent);
      } else {
        const taskIngestEvent: TaskIngestEvent = {
          id: generateUniqueID(),
          type: EventType.TaskIngest as const,
          entityID: generateUniqueID<TaskID>(),
          timestampMillis: Date.now(),
          spec,
          provenance: sourceTitle.trim() || sourceUrl.trim()
            ? {
                identifier: sourceUrl.trim() || `source:${sourceTitle.trim().toLowerCase().replace(/\s+/g, "-")}`,
                ...(sourceUrl.trim() ? { url: sourceUrl.trim() } : {}),
                ...(sourceTitle.trim() ? { title: sourceTitle.trim() } : {}),
              }
            : null,
        };
        events.push(taskIngestEvent);
      }

      await databaseManager.recordEvents(events);

      if (editId) {
        showToast("Updated!");
        router.back();
      } else {
        setQuestion("");
        setAnswer("");
        setImage(null);
        if (!contextPinned) setContext("");
        if (!sourcePinned) {
          setSourceTitle("");
          setSourceUrl("");
        }
        setReview(null);
        setReviewError(null);
        showToast("Saved!");
      }
    } catch (error) {
      console.error("Failed to save card:", error);
      showToast("Save failed. Check console.", 3000);
    } finally {
      setSaving(false);
    }
  }

  const questionPreview: TaskContentField = image
    ? { text: question || "Your question here...", attachments: ["preview" as AttachmentID] }
    : { text: question || "Your question here...", attachments: [] };

  const answerPreview: TaskContentField = {
    text: answer || "Your answer here...",
    attachments: [],
  };

  // For preview, resolve the picked image URI directly.
  const getURLForAttachmentID = useCallback(
    async (_id: AttachmentID): Promise<string | null> => {
      return image?.uri ?? null;
    },
    [image],
  );

  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  return (
    <View style={{ backgroundColor: neutral.bg, flex: 1 }}>
      <View
        style={{
          width: "100%",
          maxWidth: isWide ? 1100 : maximumContentWidth,
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
            {editId ? "Edit Card" : "Add Card"}
          </Text>
          <View style={{ flexDirection: "row", gap: gridUnit }}>
            <NavButton label="All Cards" onPress={() => router.push("/cards")} />
            <NavButton label="Review" onPress={() => router.replace("/")} />
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: edgeMargin,
            paddingBottom: gridUnit * 4,
            ...(isWide && { flexDirection: "row", alignItems: "flex-start" }),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Left column: form */}
          <View style={{ maxWidth: isWide ? 550 : undefined, flex: isWide ? undefined : 1, width: isWide ? 550 : "100%" }}>
            {/* Question */}
            <Text
              style={[
                styles.type.labelSmall.typeStyle,
                { color: neutral.textSoft, marginBottom: gridUnit / 2 },
              ]}
            >
              Question
            </Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              multiline
              placeholder="What is...?"
              placeholderTextColor={neutral.textSoft}
              style={{
                fontSize: 14,
                lineHeight: 20,
                padding: gridUnit * 2,
                borderRadius,
                backgroundColor: neutral.card,
                borderWidth: 1,
                borderColor: neutral.border,
                color: neutral.text,
                minHeight: 80,
              }}
            />

            {/* Answer */}
            <Text
              style={[
                styles.type.labelSmall.typeStyle,
                { color: neutral.textSoft, marginTop: gridUnit * 2, marginBottom: gridUnit / 2 },
              ]}
            >
              Answer
            </Text>
            <TextInput
              value={answer}
              onChangeText={setAnswer}
              multiline
              placeholder="The answer is..."
              placeholderTextColor={neutral.textSoft}
              style={{
                fontSize: 14,
                lineHeight: 20,
                padding: gridUnit * 2,
                borderRadius,
                backgroundColor: neutral.card,
                borderWidth: 1,
                borderColor: neutral.border,
                color: neutral.text,
                minHeight: 80,
              }}
            />

            {/* Image attachment */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: gridUnit * 2,
                marginTop: gridUnit * 2,
              }}
            >
              <NavButton label="Attach Image" onPress={handlePickImage} />
              {image && (
                <View style={{ position: "relative" }}>
                  <Image
                    source={{ uri: image.uri }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: borderRadius / 2,
                      borderWidth: 1,
                      borderColor: neutral.border,
                    }}
                  />
                  <Pressable
                    onPress={() => setImage(null)}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: neutral.text,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, lineHeight: 14, fontWeight: "bold" }}>
                      {"\u00D7"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Preview */}
            <Text
              style={[
                styles.type.labelSmall.typeStyle,
                { color: neutral.textSoft, marginTop: gridUnit * 3, marginBottom: gridUnit },
              ]}
            >
              Preview
            </Text>
            <View
              style={{
                backgroundColor: neutral.card,
                borderRadius,
                borderWidth: 1,
                borderColor: neutral.border,
                padding: gridUnit * 2,
                minHeight: 120,
              }}
            >
              <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft, marginBottom: gridUnit / 2 }]}>
                Q:
              </Text>
              <PromptFieldRenderer
                promptField={questionPreview}
                getURLForAttachmentID={getURLForAttachmentID}
                largestSizeVariantIndex={4}
                smallestSizeVariantIndex={4}
              />
              <View style={{ height: gridUnit * 2, borderBottomWidth: 1, borderBottomColor: neutral.border, marginBottom: gridUnit * 2 }} />
              <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft, marginBottom: gridUnit / 2 }]}>
                A:
              </Text>
              <PromptFieldRenderer
                promptField={answerPreview}
                getURLForAttachmentID={getURLForAttachmentID}
                largestSizeVariantIndex={4}
                smallestSizeVariantIndex={4}
              />
            </View>

            {/* Save */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: gridUnit * 2,
                marginTop: gridUnit * 2,
              }}
            >
              <NavButton
                label={saving ? "Saving..." : editId ? "Update Card" : "Save Card"}
                onPress={handleSave}
                primary
                disabled={!databaseManager || saving}
              />
              <NavButton
                label={reviewing ? "Reviewing..." : "Review with AI"}
                onPress={handleReview}
                disabled={!canReview || reviewing}
              />
            </View>
          </View>

          {/* Context + AI Review: Web sidebar / Mobile collapsible */}
          {isWide ? (
            /* Web: Sticky sidebar */
            <View
              style={{
                flex: 1,
                marginLeft: gridUnit * 3,
                position: "sticky" as any,
                top: 0,
                alignSelf: "flex-start",
                maxHeight: "calc(100vh - 8rem)" as any,
                overflow: "auto" as any,
              }}
            >
              {/* Source (new cards only) */}
              {!editId && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: gridUnit / 2 }}>
                    <Text
                      style={[
                        styles.type.labelSmall.typeStyle,
                        { color: neutral.textSoft, flex: 1 },
                      ]}
                    >
                      Source
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (sourcePinned) {
                          localStorage.removeItem("orbit:pinned-source");
                          setSourcePinned(false);
                        } else {
                          localStorage.setItem(
                            "orbit:pinned-source",
                            JSON.stringify({ title: sourceTitle, url: sourceUrl }),
                          );
                          setSourcePinned(true);
                        }
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: sourcePinned ? neutral.accent : neutral.textSoft }}>
                        {"\u25C9"}
                      </Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={sourceTitle}
                    onChangeText={(text) => {
                      setSourceTitle(text);
                      if (sourcePinned) {
                        localStorage.setItem(
                          "orbit:pinned-source",
                          JSON.stringify({ title: text, url: sourceUrl }),
                        );
                      }
                    }}
                    placeholder="Article title, book, topic..."
                    placeholderTextColor={neutral.textSoft}
                    style={{
                      fontSize: 14,
                      lineHeight: 20,
                      padding: gridUnit * 2,
                      borderRadius,
                      backgroundColor: neutral.card,
                      borderWidth: 1,
                      borderColor: neutral.border,
                      color: neutral.text,
                      marginBottom: gridUnit / 2,
                    }}
                  />
                  <TextInput
                    value={sourceUrl}
                    onChangeText={(text) => {
                      setSourceUrl(text);
                      if (sourcePinned) {
                        localStorage.setItem(
                          "orbit:pinned-source",
                          JSON.stringify({ title: sourceTitle, url: text }),
                        );
                      }
                    }}
                    placeholder="https://..."
                    placeholderTextColor={neutral.textSoft}
                    autoCapitalize="none"
                    keyboardType="url"
                    style={{
                      fontSize: 14,
                      lineHeight: 20,
                      padding: gridUnit * 2,
                      borderRadius,
                      backgroundColor: neutral.card,
                      borderWidth: 1,
                      borderColor: neutral.border,
                      color: neutral.text,
                    }}
                  />
                </>
              )}

              <ContextSection
                value={context}
                onChangeText={setContext}
                pinned={contextPinned}
                onPinnedChange={setContextPinned}
                isWide
                hasReview={!!review}
              />

              {/* Generate cards from context */}
              {!editId && (
                <View style={{ marginTop: gridUnit * 2 }}>
                  <NavButton
                    label={generating ? "Generating..." : "Generate Cards"}
                    onPress={handleGenerate}
                    disabled={!canGenerate || generating}
                  />
                  {generateError && (
                    <Text style={[styles.type.runningTextSmall.typeStyle, { color: "#dc2626", marginTop: gridUnit }]}>
                      {generateError}
                    </Text>
                  )}
                  {generatedCards.map((card, i) => (
                    <View
                      key={card.id}
                      style={{
                        marginTop: gridUnit,
                        padding: gridUnit * 2,
                        borderRadius,
                        backgroundColor: neutral.card,
                        borderWidth: 1,
                        borderColor: neutral.border,
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: gridUnit,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text }]}>
                          Q: {card.question}
                        </Text>
                        <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.textSoft, marginTop: gridUnit / 2 }]}>
                          A: {card.answer}
                        </Text>
                      </View>
                      <NavButton
                        label="Add"
                        onPress={() => handleAddGeneratedCard(i)}
                        disabled={!databaseManager}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* AI Review results */}
              {reviewError && (
                <View style={{ marginTop: gridUnit * 2 }}>
                  <Text style={[styles.type.runningTextSmall.typeStyle, { color: "#dc2626" }]}>
                    {reviewError}
                  </Text>
                </View>
              )}
              {review && (
                <View
                  style={{
                    marginTop: gridUnit * 2,
                    padding: gridUnit * 2,
                    borderRadius,
                    backgroundColor: neutral.card,
                    borderWidth: 1,
                    borderColor: neutral.border,
                  }}
                >
                    {/* Verdict badge */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: gridUnit }}>
                      <View
                        style={{
                          backgroundColor: verdictColors[review.verdict],
                          paddingHorizontal: gridUnit,
                          paddingVertical: gridUnit / 2,
                          borderRadius: borderRadius / 2,
                        }}
                      >
                        <Text
                          style={[
                            styles.type.labelSmall.typeStyle,
                            { color: "#fff" },
                          ]}
                        >
                          {verdictLabels[review.verdict]}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.type.runningTextSmall.typeStyle,
                          { color: neutral.text, flex: 1 },
                        ]}
                      >
                        {review.summary}
                      </Text>
                    </View>

                    {/* Issues */}
                    {review.issues.length > 0 && (
                      <View style={{ marginTop: gridUnit * 2 }}>
                        {review.issues.map((issue, i) => (
                          <View
                            key={i}
                            style={{
                              marginBottom: gridUnit,
                              padding: gridUnit,
                              backgroundColor: neutral.bg,
                              borderRadius: borderRadius / 2,
                            }}
                          >
                            <Text
                              style={[
                                styles.type.labelSmall.typeStyle,
                                { color: neutral.textSoft, marginBottom: 2 },
                              ]}
                            >
                              {issue.category}
                            </Text>
                            <Text
                              style={[
                                styles.type.runningTextSmall.typeStyle,
                                { color: neutral.text },
                              ]}
                            >
                              {issue.description}
                            </Text>
                            <Text
                              style={[
                                styles.type.runningTextSmall.typeStyle,
                                { color: neutral.textSoft, fontStyle: "italic", marginTop: 2 },
                              ]}
                            >
                              {issue.suggestion}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Rewrite suggestions */}
                    {review.rewrite && (review.rewrite.question || review.rewrite.answer) && (
                      <View style={{ marginTop: gridUnit }}>
                        <Text
                          style={[
                            styles.type.labelSmall.typeStyle,
                            { color: neutral.textSoft, marginBottom: gridUnit / 2 },
                          ]}
                        >
                          Suggested rewrite
                        </Text>
                        {review.rewrite.question && (
                          <Text
                            style={[
                              styles.type.runningTextSmall.typeStyle,
                              { color: neutral.text, marginBottom: 2 },
                            ]}
                          >
                            Q: {review.rewrite.question}
                          </Text>
                        )}
                        {review.rewrite.answer && (
                          <Text
                            style={[
                              styles.type.runningTextSmall.typeStyle,
                              { color: neutral.text, marginBottom: gridUnit },
                            ]}
                          >
                            A: {review.rewrite.answer}
                          </Text>
                        )}
                        <NavButton
                          label="Apply rewrite"
                          onPress={() => {
                            if (review.rewrite?.question) setQuestion(review.rewrite.question);
                            if (review.rewrite?.answer) setAnswer(review.rewrite.answer);
                          }}
                        />
                      </View>
                    )}
                </View>
              )}
            </View>
          ) : (
            /* Mobile: Source + Collapsible inline context */
            <>
            {!editId && (
              <View style={{ marginTop: gridUnit * 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: gridUnit / 2 }}>
                  <Text
                    style={[
                      styles.type.labelSmall.typeStyle,
                      { color: neutral.textSoft, flex: 1 },
                    ]}
                  >
                    Source
                  </Text>
                  {Platform.OS === "web" && (
                    <Pressable
                      onPress={() => {
                        if (sourcePinned) {
                          localStorage.removeItem("orbit:pinned-source");
                          setSourcePinned(false);
                        } else {
                          localStorage.setItem(
                            "orbit:pinned-source",
                            JSON.stringify({ title: sourceTitle, url: sourceUrl }),
                          );
                          setSourcePinned(true);
                        }
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: sourcePinned ? neutral.accent : neutral.textSoft }}>
                        {"\u25C9"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  value={sourceTitle}
                  onChangeText={(text) => {
                    setSourceTitle(text);
                    if (sourcePinned && Platform.OS === "web") {
                      localStorage.setItem(
                        "orbit:pinned-source",
                        JSON.stringify({ title: text, url: sourceUrl }),
                      );
                    }
                  }}
                  placeholder="Article title, book, topic..."
                  placeholderTextColor={neutral.textSoft}
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    padding: gridUnit * 2,
                    borderRadius,
                    backgroundColor: neutral.card,
                    borderWidth: 1,
                    borderColor: neutral.border,
                    color: neutral.text,
                    marginBottom: gridUnit / 2,
                  }}
                />
                <TextInput
                  value={sourceUrl}
                  onChangeText={(text) => {
                    setSourceUrl(text);
                    if (sourcePinned && Platform.OS === "web") {
                      localStorage.setItem(
                        "orbit:pinned-source",
                        JSON.stringify({ title: sourceTitle, url: text }),
                      );
                    }
                  }}
                  placeholder="https://..."
                  placeholderTextColor={neutral.textSoft}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    padding: gridUnit * 2,
                    borderRadius,
                    backgroundColor: neutral.card,
                    borderWidth: 1,
                    borderColor: neutral.border,
                    color: neutral.text,
                  }}
                />
              </View>
            )}
            <ContextSection
              value={context}
              onChangeText={setContext}
              pinned={contextPinned}
              onPinnedChange={setContextPinned}
              isWide={false}
              scrollViewRef={scrollViewRef}
            />
            {/* Mobile: Generate cards from context */}
            {!editId && (
              <View style={{ marginTop: gridUnit * 2 }}>
                <NavButton
                  label={generating ? "Generating..." : "Generate Cards"}
                  onPress={handleGenerate}
                  disabled={!canGenerate || generating}
                />
                {generateError && (
                  <Text style={[styles.type.runningTextSmall.typeStyle, { color: "#dc2626", marginTop: gridUnit }]}>
                    {generateError}
                  </Text>
                )}
                {generatedCards.map((card, i) => (
                  <View
                    key={card.id}
                    style={{
                      marginTop: gridUnit,
                      padding: gridUnit * 2,
                      borderRadius,
                      backgroundColor: neutral.card,
                      borderWidth: 1,
                      borderColor: neutral.border,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: gridUnit,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text }]}>
                        Q: {card.question}
                      </Text>
                      <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.textSoft, marginTop: gridUnit / 2 }]}>
                        A: {card.answer}
                      </Text>
                    </View>
                    <NavButton
                      label="Add"
                      onPress={() => handleAddGeneratedCard(i)}
                      disabled={!databaseManager}
                    />
                  </View>
                ))}
              </View>
            )}
            </>
          )}

          {/* Mobile: AI Review results below context */}
          {!isWide && (reviewError || review) && (
            <View
              style={{
                marginTop: gridUnit * 2,
                borderWidth: 1,
                borderColor: neutral.border,
                borderRadius,
                padding: gridUnit * 2,
                backgroundColor: neutral.card,
              }}
            >
              {reviewError && (
                <Text style={[styles.type.runningTextSmall.typeStyle, { color: "#dc2626" }]}>
                  {reviewError}
                </Text>
              )}
              {review && (
                <>
                  {/* Verdict badge */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: gridUnit, marginBottom: gridUnit * 2 }}>
                    <View
                      style={{
                        backgroundColor: verdictColors[review.verdict],
                        paddingHorizontal: gridUnit,
                        paddingVertical: gridUnit / 2,
                        borderRadius: borderRadius / 2,
                      }}
                    >
                      <Text style={[styles.type.labelSmall.typeStyle, { color: "#fff" }]}>
                        {verdictLabels[review.verdict]}
                      </Text>
                    </View>
                    <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text, flex: 1 }]}>
                      {review.summary}
                    </Text>
                  </View>

                  {/* Issues */}
                  {review.issues.length > 0 && (
                    <View style={{ marginBottom: gridUnit * 2 }}>
                      {review.issues.map((issue, i) => (
                        <View
                          key={i}
                          style={{
                            marginBottom: gridUnit,
                            padding: gridUnit,
                            backgroundColor: neutral.bg,
                            borderRadius: borderRadius / 2,
                          }}
                        >
                          <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft, marginBottom: 2 }]}>
                            {issue.category}
                          </Text>
                          <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text }]}>
                            {issue.description}
                          </Text>
                          <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.textSoft, fontStyle: "italic", marginTop: 2 }]}>
                            {issue.suggestion}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Rewrite suggestions */}
                  {review.rewrite && (review.rewrite.question || review.rewrite.answer) && (
                    <>
                      <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft, marginBottom: gridUnit / 2 }]}>
                        Suggested rewrite
                      </Text>
                      {review.rewrite.question && (
                        <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text, marginBottom: 2 }]}>
                          Q: {review.rewrite.question}
                        </Text>
                      )}
                      {review.rewrite.answer && (
                        <Text style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text, marginBottom: gridUnit }]}>
                          A: {review.rewrite.answer}
                        </Text>
                      )}
                      <NavButton
                        label="Apply rewrite"
                        onPress={() => {
                          if (review.rewrite?.question) setQuestion(review.rewrite.question);
                          if (review.rewrite?.answer) setAnswer(review.rewrite.answer);
                        }}
                      />
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Toast */}
      {toast && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: gridUnit * 4,
            alignSelf: "center",
            opacity: toastOpacity,
            backgroundColor: neutral.text,
            paddingHorizontal: gridUnit * 2,
            paddingVertical: gridUnit,
            borderRadius,
          }}
        >
          <Text style={[styles.type.labelSmall.typeStyle, { color: "#fff" }]}>
            {toast}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
