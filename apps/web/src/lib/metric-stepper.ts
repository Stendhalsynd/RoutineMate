function parseMetricNumber(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampMetricValue(value: number, min: number, max: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Math.max(min, Math.min(max, rounded));
}

function formatMetricValue(value: number): string {
  return value.toFixed(1);
}

export function normalizeMetricInput(rawValue: string, min: number, max: number): string {
  const parsed = parseMetricNumber(rawValue);
  if (parsed === null) {
    return "";
  }
  return formatMetricValue(clampMetricValue(parsed, min, max));
}

export function adjustMetricInputValue(currentValue: string, delta: number, min: number, max: number): string {
  const parsed = parseMetricNumber(currentValue) ?? min;
  return formatMetricValue(clampMetricValue(parsed + delta, min, max));
}
