export type ColorToken = {
  background: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  brand: string;
  brandOn: string;
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
};
