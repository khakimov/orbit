import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { layout } from "../styles/index.js";

interface AudioPlayButtonProps {
  url: string;
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
function PlayIcon() {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 14,
        borderTopWidth: 9,
        borderBottomWidth: 9,
        borderLeftColor: "#fff",
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        marginLeft: 3,
      }}
    />
  );
}

function StopIcon() {
  return (
    <View
      style={{
        width: 12,
        height: 12,
        backgroundColor: "#fff",
        borderRadius: 1,
      }}
    />
  );
}

export default React.memo(function AudioPlayButton({
  url,
}: AudioPlayButtonProps) {
  const { isPlaying, toggle } = useAudioPlayback(url);

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Stop audio" : "Play audio"}
    >
      {isPlaying ? <StopIcon /> : <PlayIcon />}
    </Pressable>
  );
});

const buttonSize = layout.gridUnit * 5;

const styles = StyleSheet.create({
  button: {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: layout.gridUnit,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
