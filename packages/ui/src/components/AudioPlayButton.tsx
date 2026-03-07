import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { layout } from "../styles/index.js";

interface AudioPlayButtonProps {
  url: string;
  size?: "regular" | "large";
}

function useAudioPlayback(url: string) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Stop playback when URL changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, [url]);

  const toggle = useCallback(() => {
    if (Platform.OS !== "web") {
      // Native audio playback would use expo-av; for now web-only
      return;
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
    } else {
      const audio = new Audio(url);
      audio.onended = () => {
        audioRef.current = null;
        setIsPlaying(false);
      };
      audio.onerror = () => {
        console.warn("Audio playback failed");
        audioRef.current = null;
        setIsPlaying(false);
      };
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying, url]);

  return { isPlaying, toggle };
}

// Triangle (play) and square (stop) drawn with plain Views
function PlayIcon({ large }: { large?: boolean }) {
  const scale = large ? 2 : 1;
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 14 * scale,
        borderTopWidth: 9 * scale,
        borderBottomWidth: 9 * scale,
        borderLeftColor: "#fff",
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        marginLeft: 3 * scale,
      }}
    />
  );
}

function StopIcon({ large }: { large?: boolean }) {
  const s = large ? 24 : 12;
  return (
    <View
      style={{
        width: s,
        height: s,
        backgroundColor: "#fff",
        borderRadius: 1,
      }}
    />
  );
}

export default React.memo(function AudioPlayButton({
  url,
  size = "regular",
}: AudioPlayButtonProps) {
  const { isPlaying, toggle } = useAudioPlayback(url);
  const large = size === "large";
  const s = large ? layout.gridUnit * 10 : layout.gridUnit * 5;

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        {
          width: s,
          height: s,
          borderRadius: s / 2,
          backgroundColor: "rgba(0,0,0,0.15)",
          alignItems: "center" as const,
          justifyContent: "center" as const,
          alignSelf: "flex-start" as const,
        },
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Stop audio" : "Play audio"}
    >
      {isPlaying ? <StopIcon large={large} /> : <PlayIcon large={large} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.7,
  },
});
