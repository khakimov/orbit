import { styles } from "@withorbit/ui";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { neutral } from "../../../components/PageShared.js";

const { gridUnit, borderRadius } = styles.layout;

const STORAGE_KEY = "orbit:pinned-context";

interface ContextSectionProps {
  value: string;
  onChangeText: (text: string) => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  /** Desktop (wide) vs mobile layout */
  isWide: boolean;
  /** Shrink textarea when review is visible */
  hasReview?: boolean;
  /** ScrollView ref for auto-scroll on mobile expand */
  scrollViewRef?: React.RefObject<ScrollView>;
}

export function ContextSection({
  value,
  onChangeText,
  pinned,
  onPinnedChange,
  isWide,
  hasReview,
  scrollViewRef,
}: ContextSectionProps) {
  if (isWide) {
    return (
      <DesktopContext
        value={value}
        onChangeText={onChangeText}
        pinned={pinned}
        onPinnedChange={onPinnedChange}
        hasReview={hasReview}
      />
    );
  }

  return (
    <MobileContext
      value={value}
      onChangeText={onChangeText}
      scrollViewRef={scrollViewRef}
    />
  );
}

// -- Desktop: label + bordered textarea with pin toggle -----------------------

function DesktopContext({
  value,
  onChangeText,
  pinned,
  onPinnedChange,
  hasReview,
}: {
  value: string;
  onChangeText: (text: string) => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  hasReview?: boolean;
}) {
  function handleTogglePin() {
    if (pinned) {
      localStorage.removeItem(STORAGE_KEY);
      onPinnedChange(false);
    } else {
      localStorage.setItem(STORAGE_KEY, value);
      onPinnedChange(true);
    }
  }

  function handleChange(text: string) {
    onChangeText(text);
    if (pinned) {
      localStorage.setItem(STORAGE_KEY, text);
    }
  }

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: gridUnit * 2, marginBottom: gridUnit / 2 }}>
        <Text
          style={[
            styles.type.labelSmall.typeStyle,
            { color: neutral.textSoft, flex: 1 },
          ]}
        >
          {"Context  "}
          {value.length > 0 && (
            <Text style={{ fontSize: 10, color: neutral.textSoft }}>
              {`~${Math.ceil(value.length / 4)} tokens`}
            </Text>
          )}
        </Text>
        <Pressable
          onPress={handleTogglePin}
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, color: pinned ? neutral.accent : neutral.textSoft }}>
            {"\u25C9"}
          </Text>
        </Pressable>
      </View>
      <TextInput
        value={value}
        onChangeText={handleChange}
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
          minHeight: hasReview ? 120 : 300,
        }}
      />
    </>
  );
}

// -- Mobile: collapsible inline + full-screen modal ---------------------------

function MobileContext({
  value,
  onChangeText,
  scrollViewRef,
}: {
  value: string;
  onChangeText: (text: string) => void;
  scrollViewRef?: React.RefObject<ScrollView>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const containerRef = useRef<View>(null);

  const hasContent = value.length > 0;

  const preview = useMemo(() => {
    if (!value) return null;
    const firstLine = value.split("\n")[0];
    return firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;
  }, [value]);

  // Scroll to show content when expanded
  useEffect(() => {
    if (!expanded || !scrollViewRef?.current || !containerRef.current) return;

    const timeout = setTimeout(() => {
      containerRef.current?.measureLayout(
        scrollViewRef.current as any,
        (_x, y) => {
          scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
        },
        () => {},
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
          overflow: "hidden",
        }}
      >
        {/* Header - tap to expand/collapse, long press for modal */}
        <Pressable
          onPress={() => setExpanded(!expanded)}
          onLongPress={() => setModalVisible(true)}
          delayLongPress={400}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: gridUnit,
            paddingHorizontal: gridUnit * 1.5,
          }}
        >
          <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft, flex: 1 }]}>
            {"📄 Context "}
            {hasContent && (
              <Text style={{ fontSize: 10, color: neutral.textSoft }}>
                {`~${Math.ceil(value.length / 4)} tokens`}
              </Text>
            )}
          </Text>
          <Text style={{ color: neutral.textSoft, fontSize: 12 }}>
            {expanded ? "\u25BC" : hasContent ? "\u25B6" : "+"}
          </Text>
        </Pressable>

        {/* Expanded inline input */}
        {expanded && (
          <View style={{ padding: gridUnit, paddingTop: 0 }}>
            <TextInput
              value={value}
              onChangeText={onChangeText}
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
                alignSelf: "flex-end",
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
              {preview}
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
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
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
              <Text style={[styles.type.labelSmall.typeStyle, { color: "#fff" }]}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* Modal Content */}
          <ScrollView style={{ flex: 1 }}>
            <TextInput
              value={value}
              onChangeText={onChangeText}
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
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft }]}>
              {value.length} characters
            </Text>
            <Text style={[styles.type.labelSmall.typeStyle, { color: neutral.textSoft }]}>
              ~{Math.ceil(value.length / 4)} tokens
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
