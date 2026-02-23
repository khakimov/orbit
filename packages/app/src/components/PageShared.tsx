import { styles } from "@withorbit/ui";
import React from "react";
import { Pressable, Text } from "react-native";

const { gridUnit, borderRadius } = styles.layout;

export const neutral = {
  bg: "#f5f5f4",
  card: "#ffffff",
  border: "#e5e5e4",
  text: styles.colors.ink,
  textSoft: "rgba(0,0,0,0.45)",
  accent: styles.colors.productKeyColor,
};

export function NavButton({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: primary ? neutral.accent : neutral.card,
        borderWidth: primary ? 0 : 1,
        borderColor: neutral.border,
        paddingHorizontal: gridUnit * 2,
        paddingVertical: gridUnit,
        borderRadius,
        opacity: disabled ? 0.5 : 1,
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
