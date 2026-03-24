export type MetricDigits = {
  tens: number;
  ones: number;
  tenths: number;
};

export const WHEEL_LOOP_SIZE = 300;
export const WHEEL_CENTER_INDEX = 150;

function parseMetricNumber(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function wrapDigit(value: number): number {
  return ((value % 10) + 10) % 10;
}

export function getWheelLoopIndex(index: number): number {
  return wrapDigit(index);
}

export function recenterWheelIndex(index: number, centerIndex = WHEEL_CENTER_INDEX): number {
  return centerIndex + wrapDigit(index);
}

export function clampMetricValue(value: number, min: number, max: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Math.max(min, Math.min(max, rounded));
}

export function formatMetricValue(value: number): string {
  return value.toFixed(1);
}

export function resolveDefaultMetricValue(currentValue: string, recentValue: string, min: number, max: number): string {
  const parsed = parseMetricNumber(currentValue) ?? parseMetricNumber(recentValue) ?? min;
  return formatMetricValue(clampMetricValue(parsed, min, max));
}

export function resolveMetricDigits(rawValue: string, min: number, max: number): MetricDigits {
  const parsed = parseMetricNumber(rawValue);
  const normalized = clampMetricValue(parsed ?? min, min, max);
  const scaled = Math.round(normalized * 10);
  const integerPart = Math.floor(scaled / 10);
  return {
    tens: Math.floor(integerPart / 10) % 10,
    ones: integerPart % 10,
    tenths: scaled % 10
  };
}

export function digitsToMetricNumber(digits: MetricDigits): number {
  return digits.tens * 10 + digits.ones + digits.tenths / 10;
}

export function getWheelSeedIndices(digits: MetricDigits): Record<keyof MetricDigits, number> {
  return {
    tens: recenterWheelIndex(digits.tens),
    ones: recenterWheelIndex(digits.ones),
    tenths: recenterWheelIndex(digits.tenths)
  };
}

export function isMetricDigitsAllowed(digits: MetricDigits, min: number, max: number): boolean {
  const value = digitsToMetricNumber(digits);
  return value >= min && value <= max;
}

export function resolveQuickMetricValue(
  currentValue: string,
  recentValue: string,
  delta: number,
  min: number,
  max: number
): string {
  const base = parseMetricNumber(currentValue) ?? parseMetricNumber(recentValue) ?? min;
  return formatMetricValue(clampMetricValue(base + delta, min, max));
}
