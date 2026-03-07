import {
  ClozeTaskContent,
  ClozeTaskContentComponent,
  isAudioMIMEType,
  QATaskContent,
  TaskContentType,
  TaskProvenance,
} from "@withorbit/core";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlexStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { ReviewAreaItem } from "../reviewAreaItem.js";
import { colors, layout, type } from "../styles/index.js";
import AudioPlayButton from "./AudioPlayButton.jsx";
import {
  AttachmentResolution,
  useAttachmentResolver,
} from "./AttachmentResolverContext.js";
import Button from "./Button.jsx";
import FadeView from "./FadeView.jsx";
import {
  AnimatedTransitionTiming,
  useTransitioningValue,
} from "./hooks/useTransitioningValue.js";
import useWeakRef from "./hooks/useWeakRef.js";
import CardField, { clozeBlankSentinel } from "./PromptFieldRenderer.js";
import {
  clozeEndHighlightSentinel,
  clozeStartHighlightSentinel,
} from "./PromptFieldRenderer/clozeHighlightPlugin.js";

function getQAPromptContents<TC extends QATaskContent | ClozeTaskContent>(
  reviewItem: ReviewAreaItem<TC>,
): QATaskContent {
  switch (reviewItem.spec.content.type) {
    case TaskContentType.QA:
      // This cast should not be needed... My IDE does not throw any error
      // without the cast, but TSC throws:
      // `Type 'TC' is not assignable to type 'QATaskContent'`.
      // casting resolves the type issue...
      return reviewItem.spec.content as QATaskContent;
    case TaskContentType.Cloze:
      throw new Error("cloze prompt is not a QA prompt");
  }
}

const bottomAreaTranslationAnimationSpec: AnimatedTransitionTiming = {
  type: "spring",
  bounciness: 0,
  speed: 28,
  useNativeDriver: true,
};

const topAreaTranslationAnimationSpec: AnimatedTransitionTiming = {
  ...bottomAreaTranslationAnimationSpec,
  delay: 50,
};

function useAnimatingStyles(backIsRevealed: boolean): {
  topAreaStyle: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  bottomFrontStyle: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  bottomBackStyle: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
} {
  const topAreaTranslateAnimation = useTransitioningValue({
    value: backIsRevealed ? 1 : 0,
    timing: topAreaTranslationAnimationSpec,
  });
  const bottomAreaTranslateAnimation = useTransitioningValue({
    value: backIsRevealed ? 1 : 0,
    timing: bottomAreaTranslationAnimationSpec,
  });

  return React.useMemo(() => {
    return {
      topAreaStyle: [
        StyleSheet.absoluteFill,
        {
          transform: [
            {
              translateY: topAreaTranslateAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ],
      bottomFrontStyle: [
        StyleSheet.absoluteFill,
        {
          transform: [
            {
              translateY: bottomAreaTranslateAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
            },
          ],
        },
      ],
      bottomBackStyle: {
        transform: [
          {
            translateY: bottomAreaTranslateAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      },
    };
  }, [bottomAreaTranslateAnimation, topAreaTranslateAnimation]);
}

function PromptContextLabel({
  provenance,
  size,
  style,
  accentColor,
}: {
  provenance: TaskProvenance | null;
  size: "regular" | "small";
  style?: FlexStyle;
  accentColor?: string;
}) {
  const color = accentColor ?? colors.ink;
  const numberOfLines = size === "regular" ? 3 : 1;
  return provenance?.title ? (
    <View style={style}>
      {provenance.url ? (
        <Button
          size={size === "regular" ? "regular" : "tiny"}
          href={provenance.url}
          title={provenance.title}
          color={color}
          numberOfLines={numberOfLines}
          ellipsizeMode="tail"
        />
      ) : (
        <Text
          style={[
            size === "regular"
              ? type.label.layoutStyle
              : type.labelTiny.layoutStyle,
            {
              color,
            },
          ]}
          numberOfLines={numberOfLines}
          ellipsizeMode="tail"
        >
          {provenance.title}
        </Text>
      )}
    </View>
  ) : null;
}

function formatClozePromptContents(
  text: string,
  component: ClozeTaskContentComponent,
  isRevealed: boolean,
) {
  let mutatingText: string = text;
  for (const range of component.ranges) {
    if (isRevealed) {
      mutatingText =
        mutatingText.slice(0, range.startIndex) +
        clozeStartHighlightSentinel +
        mutatingText.slice(range.startIndex, range.startIndex + range.length) +
        clozeEndHighlightSentinel +
        mutatingText.slice(range.startIndex + range.length);
    } else {
      mutatingText =
        mutatingText.slice(0, range.startIndex) +
        clozeBlankSentinel +
        mutatingText.slice(range.startIndex + range.length);
    }
  }
  return mutatingText;
}

type PromptProportion = [topProportion: number, bottomProportion: number];
function getProportions(contents: QATaskContent): {
  unrevealed: PromptProportion;
  revealed: PromptProportion;
} {
  const questionHasAttachments = contents.body.attachments.length > 0;
  const answerHasAttachments = contents.answer.attachments.length > 0;
  if (!questionHasAttachments && !answerHasAttachments) {
    return { unrevealed: [2, 3], revealed: [2, 3] };
  } else if (questionHasAttachments && !answerHasAttachments) {
    return { unrevealed: [1, 5], revealed: [1, 1] };
  } else if (!questionHasAttachments && answerHasAttachments) {
    return { unrevealed: [2, 3], revealed: [1, 3] };
  } else {
    return { unrevealed: [1, 3], revealed: [1, 2] };
  }
}

export interface CardProps {
  reviewItem: ReviewAreaItem;
  backIsRevealed: boolean;

  accentColor?: string;
}

type QAPromptRendererType = Omit<CardProps, "reviewItem"> & {
  reviewItem: ReviewAreaItem<QATaskContent>;
};

function useCardAudio(contents: QATaskContent): {
  audioURL: string | null;
  audioSide: "body" | "answer" | null;
} {
  const resolver = useAttachmentResolver();
  const [result, setResult] = useState<{
    audioURL: string | null;
    audioSide: "body" | "answer" | null;
  }>({ audioURL: null, audioSide: null });

  const bodyAttachment = contents.body.attachments[0] ?? null;
  const answerAttachment = contents.answer.attachments[0] ?? null;
  const _resolver = useWeakRef(resolver);
  const pendingRef = useRef(0);

  useEffect(() => {
    const id = ++pendingRef.current;
    setResult({ audioURL: null, audioSide: null });

    async function resolve() {
      for (const [attachmentID, side] of [
        [bodyAttachment, "body"],
        [answerAttachment, "answer"],
      ] as const) {
        if (!attachmentID) continue;
        const resolution = await _resolver.current(attachmentID);
        if (pendingRef.current !== id) return;
        if (resolution && isAudioMIMEType(resolution.mimeType)) {
          setResult({ audioURL: resolution.url, audioSide: side });
          return;
        }
      }
    }

    resolve();
    return () => {
      pendingRef.current++;
    };
  }, [bodyAttachment, answerAttachment, _resolver]);

  return result;
}

function QAPromptRenderer({
  backIsRevealed,
  accentColor,
  reviewItem,
}: QAPromptRendererType) {
  const animatingStyles = useAnimatingStyles(backIsRevealed);
  const contents = getQAPromptContents(reviewItem);
  const { audioURL, audioSide } = useCardAudio(contents);
  const isAudioOnlyQuestion =
    audioSide === "body" && !contents.body.text.trim();

  const [frontSizeVariantIndex, setFrontSizeVariantIndex] = React.useState<
    number | undefined
  >(undefined);

  const proportions = getProportions(contents);

  return (
    <View style={{ flex: 1 }}>
      <FadeView
        isVisible={backIsRevealed}
        durationMillis={100}
        delayMillis={60}
        style={animatingStyles.topAreaStyle}
      >
        <PromptContextLabel
          provenance={reviewItem.provenance}
          size="small"
          style={{
            marginTop: layout.gridUnit * 2,
            marginBottom: layout.gridUnit,
          }}
          accentColor={accentColor}
        />
        <View
          style={{
            flex: proportions.revealed[0],
            marginBottom: layout.gridUnit,
            width: "66.67%",
            overflow: "hidden",
          }}
        >
          <CardField
            promptField={contents.body}
            suppressAudio={audioSide === "body"}
            largestSizeVariantIndex={
              frontSizeVariantIndex === undefined
                ? undefined
                : frontSizeVariantIndex + 1
            }
            smallestSizeVariantIndex={4}
            colorPalette={reviewItem.colorPalette}
            clipContent
          />
        </View>
        <FadeView
          isVisible={backIsRevealed}
          durationMillis={100}
          style={[
            { flex: proportions.revealed[1] },
            animatingStyles.bottomBackStyle,
          ]}
        >
          <CardField
            promptField={contents.answer}
            suppressAudio={audioSide === "answer"}
          />
        </FadeView>
      </FadeView>
      <FadeView
        style={animatingStyles.bottomFrontStyle}
        isVisible={!backIsRevealed}
        durationMillis={70}
      >
        <View
          style={{
            flex: proportions.unrevealed[0],
            marginTop: layout.gridUnit * 2,
            marginBottom: layout.gridUnit,
            justifyContent: "flex-end",
          }}
        >
          <PromptContextLabel
            provenance={reviewItem.provenance}
            size="regular"
            accentColor={accentColor}
          />
        </View>
        <View style={{ flex: proportions.unrevealed[1], overflow: "hidden" }}>
          <CardField
            promptField={contents.body}
            suppressAudio={audioSide === "body"}
            onLayout={setFrontSizeVariantIndex}
          />
        </View>
      </FadeView>
      {audioURL && isAudioOnlyQuestion && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AudioPlayButton url={audioURL} size="large" />
        </View>
      )}
      {audioURL &&
        !isAudioOnlyQuestion &&
        (audioSide === "body" || backIsRevealed) && (
          <View
            style={{
              position: "absolute",
              bottom: layout.gridUnit,
              left: 0,
            }}
          >
            <AudioPlayButton url={audioURL} />
          </View>
        )}
    </View>
  );
}

type ClozePromptRendererProps = Omit<CardProps, "reviewItem"> & {
  reviewItem: ReviewAreaItem<ClozeTaskContent>;
};

function ClozePromptRenderer({
  backIsRevealed,
  accentColor,
  reviewItem,
}: ClozePromptRendererProps) {
  const {
    componentID,
    spec: {
      content: { body, components },
    },
  } = reviewItem;
  const front = {
    ...body,
    text: formatClozePromptContents(body.text, components[componentID], false),
  };
  const back = {
    ...body,
    text: formatClozePromptContents(body.text, components[componentID], true),
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          marginTop: layout.gridUnit * 2,
          flex: 2,
          marginBottom: layout.gridUnit,
          justifyContent: "flex-end",
        }}
      >
        <PromptContextLabel
          provenance={reviewItem.provenance}
          size="regular"
          accentColor={accentColor}
        />
      </View>
      <View style={{ flex: 3 }}>
        <FadeView
          isVisible={backIsRevealed}
          durationMillis={70}
          style={StyleSheet.absoluteFill}
        >
          <CardField
            promptField={back}

            colorPalette={reviewItem.colorPalette}
          />
        </FadeView>
        <FadeView
          isVisible={!backIsRevealed}
          durationMillis={100}
          style={StyleSheet.absoluteFill}
        >
          <CardField
            promptField={front}

            colorPalette={reviewItem.colorPalette}
          />
        </FadeView>
      </View>
    </View>
  );
}

export default React.memo(function Card(props: CardProps) {
  switch (props.reviewItem.spec.content.type) {
    case TaskContentType.QA:
      return (
        <QAPromptRenderer
          {...props}
          reviewItem={props.reviewItem as ReviewAreaItem<QATaskContent>}
        />
      );
    case TaskContentType.Cloze:
      return (
        <ClozePromptRenderer
          {...props}
          reviewItem={props.reviewItem as ReviewAreaItem<ClozeTaskContent>}
        />
      );
    case TaskContentType.Plain:
      throw new Error("A plain task content type renderer does not exist yet");
  }
});
