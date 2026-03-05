export function computeLegacyChartWidth(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth)) {
    return 250;
  }
  return Math.max(250, Math.floor(viewportWidth) - 86);
}

export function computeMetricChartWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth)) {
    return 0;
  }
  return Math.max(0, Math.floor(containerWidth));
}
