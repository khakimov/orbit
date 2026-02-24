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
  Modal,
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

// Mobile: Collapsible inline context with full-screen modal editing
function MobileContextSection({
  context,
  setContext,
  expanded,
  setExpanded,
  modalVisible,
  setModalVisible,
  contextPreview,
  scrollViewRef,
}: {
  context: string;
  setContext: (s: string) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  modalVisible: boolean;
  setModalVisible: (v: boolean) => void;
  contextPreview: string | null;
  scrollViewRef?: React.RefObject<ScrollView>;
}) {
  const containerRef = useRef<View>(null);
  const hasContent = context.length > 0;

  // Scroll to show content when expanded
  useEffect(() => {
    if (!expanded || !scrollViewRef?.current || !containerRef.current) return;
    
    // Give layout time to settle, then scroll
    const timeout = setTimeout(() => {
      containerRef.current?.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
        },
        () => {} // onFail
      );
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [expanded, scrollViewRef]);

  return (
    <>
      {/* Inline collapsible preview */}
      <View
        ref={containerRef}
        style={{
          marginTop: gridUnit * 2,
          borderWidth: 1,
          borderColor: neutral.border,
          borderRadius,
          backgroundColor: neutral.card,
          overflow: 'hidden',
        }}
      >
        {/* Header - tap to expand/collapse, long press for modal */}
        <Pressable
          onPress={() => setExpanded(!expanded)}
          onLongPress={() => setModalVisible(true)}
          delayLongPress={400}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: gridUnit,
            paddingHorizontal: gridUnit * 1.5,
          }}
        >
          <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft, flex: 1 }]}>
            {"📄 Context "}
            {hasContent && (
              <Text style={{ fontSize: 10, color: neutral.textSoft }}>
                {`~${Math.ceil(context.length / 4)} tokens`}
              </Text>
            )}
          </Text>
          <Text style={{ color: neutral.textSoft, fontSize: 12 }}>
            {expanded ? '▼' : hasContent ? '▶' : '+'}
          </Text>
        </Pressable>

        {/* Expanded inline input */}
        {expanded && (
          <View style={{ padding: gridUnit, paddingTop: 0 }}>
            <TextInput
              value={context}
              onChangeText={setContext}
              multiline
              placeholder="Paste reference material, notes, or source text here..."
              placeholderTextColor={neutral.textSoft}
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: neutral.text,
                minHeight: 120,
              }}
            />
            {/* Expand button for full modal */}
            <Pressable
              onPress={() => setModalVisible(true)}
              style={{
                alignSelf: 'flex-end',
                marginTop: gridUnit,
                backgroundColor: neutral.bg,
                paddingHorizontal: gridUnit,
                paddingVertical: gridUnit / 2,
                borderRadius: borderRadius / 2,
                borderWidth: 1,
                borderColor: neutral.border,
              }}
            >
              <Text style={{ fontSize: 11, color: neutral.textSoft }}>Expand</Text>
            </Pressable>
          </View>
        )}

        {/* Collapsed preview (2 lines max) */}
        {!expanded && hasContent && (
          <View style={{ padding: gridUnit, paddingTop: 0 }}>
            <Text
              numberOfLines={2}
              style={[styles.type.runningTextSmall.typeStyle, { color: neutral.text }]}
            >
              {contextPreview}
            </Text>
          </View>
        )}
      </View>

      {/* Full-screen modal for deep editing */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: neutral.bg }}>
          {/* Modal Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: gridUnit * 2,
              paddingTop: gridUnit * 3,
              paddingBottom: gridUnit * 2,
              borderBottomWidth: 1,
              borderBottomColor: neutral.border,
              backgroundColor: neutral.card,
            }}
          >
            <Text style={[styles.type.headline.layoutStyle, { color: neutral.text }]}>
              Context
            </Text>
            <Pressable
              onPress={() => setModalVisible(false)}
              style={{
                paddingHorizontal: gridUnit * 1.5,
                paddingVertical: gridUnit / 2,
                backgroundColor: neutral.accent,
                borderRadius,
              }}
            >
              <Text style={[styles.type.labelSmall.typeStyle, { color: '#fff' }]}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* Modal Content */}
          <ScrollView style={{ flex: 1 }}>
            <TextInput
              value={context}
              onChangeText={setContext}
              multiline
              autoFocus
              placeholder="Paste reference material, notes, or source text here..."
              placeholderTextColor={neutral.textSoft}
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: neutral.text,
                padding: gridUnit * 2,
                minHeight: 400,
              }}
            />
          </ScrollView>

          {/* Footer with token count */}
          <View
            style={{
              padding: gridUnit * 2,
              borderTopWidth: 1,
              borderTopColor: neutral.border,
              backgroundColor: neutral.card,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft }]}>
              {context.length} characters
            </Text>
            <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft }]}>
              ~{Math.ceil(context.length / 4)} tokens
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
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
  
  // Mobile context UI state
  const [contextExpanded, setContextExpanded] = useState(false);
  const [contextModalVisible, setContextModalVisible] = useState(false);
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
  
  // Get preview text (first 2 lines max 100 chars)
  const contextPreview = useMemo(() => {
    if (!context) return null;
    const firstLine = context.split('\n')[0];
    return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
  }, [context]);

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
                top: gridUnit * 2,
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

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: gridUnit * 2, marginBottom: gridUnit / 2 }}>
                <Text
                  style={[
                    styles.type.labelSmall.typeStyle,
                    { color: neutral.textSoft, flex: 1 },
                  ]}
                >
                  {"Context  "}{context.length > 0 && (<Text style={{ fontSize: 10, color: neutral.textSoft }}>{`~${Math.ceil(context.length / 4)} tokens`}</Text>)}
                </Text>
                <Pressable
                  onPress={() => {
                    if (contextPinned) {
                      localStorage.removeItem("orbit:pinned-context");
                      setContextPinned(false);
                    } else {
                      localStorage.setItem("orbit:pinned-context", context);
                      setContextPinned(true);
                    }
                  }}
                  style={{
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: contextPinned ? neutral.accent : neutral.textSoft }}>
                    {"\u25C9"}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={context}
                onChangeText={(text) => {
                  setContext(text);
                  if (contextPinned) {
                    localStorage.setItem("orbit:pinned-context", text);
                  }
                }}
                multiline
                placeholder="Scratchpad for notes, source material, context..."
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
                  minHeight: review ? 120 : 300,
                }}
              />

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
            <MobileContextSection
              context={context}
              setContext={setContext}
              expanded={contextExpanded}
              setExpanded={setContextExpanded}
              modalVisible={contextModalVisible}
              setModalVisible={setContextModalVisible}
              contextPreview={contextPreview}
              scrollViewRef={scrollViewRef}
            />
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
