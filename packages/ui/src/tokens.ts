import type { UiTokens } from "./types";

export const tokens: UiTokens = {
  colors: {
    background: "#fff4cc",
    card: "#fffdf7",
    cardAlt: "#ffffff",
    border: "#111111",
    textPrimary: "#111111",
    textSecondary: "#3f3a33",
    brand: "#ffd43b",
    brandOn: "#111111",
    success: "#7ce3b4",
    info: "#84b6ff",
    danger: "#ff7b7b"
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32
  },
  cardRadius: 18,
  progressHeight: 12,
  borderWidth: 2,
  shadowOffset: 4
};

export const colors = tokens.colors;
export const spacing = tokens.spacing;
export const cardRadius = tokens.cardRadius;
export const progressHeight = tokens.progressHeight;
export const borderWidth = tokens.borderWidth;
export const shadowOffset = tokens.shadowOffset;
