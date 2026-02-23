import { Platform, TextStyle } from "react-native";
import * as colors from "./colors.js";

const type = {
  label: {
    fontSize: 16,
    lineHeight: 1.25 * 14,
  },
} as const;
export default type;

interface TypeSpec {
  typeStyle: TextStyle;
  layoutStyle: TextStyle; // includes position shifts to place text on the baseline grid, compensating for the silly baseline-ignoring layout that the web (and hence RN) do. These components position the baselines on a baseline, and they don't add any extra padding below.
  topShift: number;
  bottomShift: number;
}

// Sans-serif font for UI elements (prompts, headlines, labels).
const sansFamily = "Inter";
// Serif font for body/running text.
const serifFamily = "'Source Serif 4'";

// Weight mapping: Dr-Light=300, Dr-Regular=400, Dr-Medium=500, Dr-Bold=700, Dr-ExtraBold=800
type WeightName = "light" | "regular" | "medium" | "bold" | "extraBold";
const weightValues: Record<WeightName, TextStyle["fontWeight"]> = {
  light: "300",
  regular: "400",
  medium: "500",
  bold: "700",
  extraBold: "800",
};

const boldWeightTable: Record<WeightName, WeightName> = {
  light: "regular",
  regular: "bold",
  medium: "extraBold",
  bold: "extraBold",
  extraBold: "extraBold",
};

export function getVariantStyles(
  baseFontName: string,
  isBold: boolean,
  isItalic: boolean,
): Partial<TextStyle> {
  // Map legacy Dr-* font names to weight names for backward compatibility.
  const fontNameToWeight: Record<string, WeightName> = {
    [sansFamily]: "regular",
    "Dr-Light": "light",
    "Dr-Regular": "regular",
    "Dr-Medium": "medium",
    "Dr-Bold": "bold",
    "Dr-ExtraBold": "extraBold",
  };

  const baseWeight = fontNameToWeight[baseFontName];
  if (baseWeight) {
    const targetWeight = isBold ? boldWeightTable[baseWeight] : baseWeight;
    return {
      fontFamily: sansFamily,
      fontWeight: weightValues[targetWeight],
      fontStyle: isItalic ? "italic" : "normal",
      // When we can't bold any further, use a darker ink.
      ...(baseWeight === "bold" || baseWeight === "extraBold"
        ? isBold
          ? { color: "black" }
          : {}
        : {}),
    };
  }

  // Serif font — no weight manipulation needed.
  return {
    fontFamily: serifFamily,
    fontStyle: isItalic ? "italic" : "normal",
  };
}

const commonTypeColor = colors.ink;
const commonTypeStyles =
  Platform.OS === "web"
    ? {
        color: commonTypeColor,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      }
    : { color: commonTypeColor };

function makeTypeSpec(
  typeStyle: TextStyle,
  topShiftNative: number,
  topShiftWeb: number,
  bottomShift: number,
): TypeSpec {
  const typeWithCommonStyles = {
    ...commonTypeStyles,
    ...typeStyle,
  };

  const topShift = Platform.OS === "web" ? topShiftWeb : topShiftNative;

  return {
    typeStyle: typeWithCommonStyles,
    layoutStyle: {
      ...typeWithCommonStyles,
      position: "relative",
      // Unfortunately, React Native Web and React Native lay out text differently! See https://github.com/facebook/react-native/issues/29507.
      top: topShift,
      marginBottom: bottomShift,
    },
    topShift,
    bottomShift,
  };
}

export const promptXXLarge = makeTypeSpec(
  {
    fontSize: 96,
    fontFamily: sansFamily,
    fontWeight: "300",
    lineHeight: 84,
    letterSpacing: 96 * -0.025,
  },
  -3,
  -17,
  -20,
);

export const promptXLarge = makeTypeSpec(
  {
    fontSize: 60,
    fontFamily: sansFamily,
    fontWeight: "300",
    lineHeight: 56,
    letterSpacing: 60 * -0.015,
  },
  -6,
  -12,
  -16,
);

export const promptLarge = makeTypeSpec(
  {
    fontSize: 36,
    fontFamily: sansFamily,
    fontWeight: "400",
    lineHeight: 36,
    letterSpacing: 0,
  },
  -2,
  -7,
  -8,
);

export const promptMedium = makeTypeSpec(
  {
    fontSize: 24,
    fontFamily: sansFamily,
    fontWeight: "500",
    lineHeight: 24,
    letterSpacing: 24 * 0.01,
  },
  -4,
  -6,
  -8,
);

export const promptSmall = makeTypeSpec(
  {
    fontSize: 18,
    fontFamily: sansFamily,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: 16 * 0.02,
  },
  -3,
  -4.5,
  -7.5,
);

export const title = makeTypeSpec(
  {
    fontSize: 48,
    fontFamily: sansFamily,
    fontWeight: "500",
    lineHeight: 40,
    letterSpacing: 48 * -0.03,
  },
  -2,
  -7,
  -8,
);

export const headline = makeTypeSpec(
  {
    fontSize: 36,
    fontFamily: sansFamily,
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: 0,
  },
  -2,
  -7,
  -8,
);

export const label = makeTypeSpec(
  {
    fontSize: 24,
    fontFamily: sansFamily,
    fontWeight: "700",
    lineHeight: 24,
    letterSpacing: 24 * 0.02,
  },
  -4,
  -6,
  -8,
);

export const labelSmall = makeTypeSpec(
  {
    fontSize: 17,
    fontFamily: sansFamily,
    fontWeight: "800",
    lineHeight: 20,
    letterSpacing: 17 * 0.01,
  },
  -3,
  -4.5,
  -8,
);

export const labelTiny = makeTypeSpec(
  {
    fontSize: 12,
    fontFamily: sansFamily,
    fontWeight: "800",
    lineHeight: 16,
    letterSpacing: 13 * 0.02,
  },
  -4,
  -5,
  -8,
);

export const runningText = makeTypeSpec(
  {
    fontSize: 19,
    fontFamily: serifFamily,
    fontWeight: "400",
    lineHeight: 24,
    letterSpacing: 0,
  },
  -3,
  -3,
  -8,
);

export const runningTextSmall = makeTypeSpec(
  {
    fontSize: 16,
    fontFamily: serifFamily,
    fontWeight: "400",
    lineHeight: 20,
    letterSpacing: 0,
  },
  -4,
  -4,
  -8,
);

export const typeStyles = {
  promptXXLarge,
  promptXLarge,
  promptLarge,
  promptMedium,
  promptSmall,
  title,
  headline,
  label,
  labelSmall,
  labelTiny,
  runningText,
  runningTextSmall,
};
