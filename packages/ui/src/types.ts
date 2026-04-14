export type ColorToken = {
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  brand: string;
  brandOn: string;
  success: string;
  info: string;
  danger: string;
};

export type SpacingToken = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export type UiTokens = {
  colors: ColorToken;
  spacing: SpacingToken;
  cardRadius: number;
  progressHeight: number;
  borderWidth: number;
  shadowOffset: number;
};
