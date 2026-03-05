export type MetricPointInput = {
  date: string;
  value: number;
};

export type MetricChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MetricChartCoord = {
  x: number;
  y: number;
  point: MetricPointInput;
};

export type MetricChartLayout = {
  width: number;
  height: number;
  padding: MetricChartPadding;
  plotWidth: number;
  plotHeight: number;
  coords: MetricChartCoord[];
  linePath: string;
};

const DEFAULT_PADDING: MetricChartPadding = {
  top: 20,
  right: 16,
  bottom: 34,
  left: 40
};

const MIN_CHART_WIDTH = 220;
const MIN_CHART_HEIGHT = 120;

export function buildMetricChartLayout(
  points: MetricPointInput[],
  width: number,
  height = 220,
  padding: MetricChartPadding = DEFAULT_PADDING
): MetricChartLayout {
  const safeWidth = Math.max(Math.floor(width), MIN_CHART_WIDTH);
  const safeHeight = Math.max(Math.floor(height), MIN_CHART_HEIGHT);
  const safePadding = {
    top: Math.max(0, Math.round(padding.top)),
    right: Math.max(0, Math.round(padding.right)),
    bottom: Math.max(0, Math.round(padding.bottom)),
    left: Math.max(0, Math.round(padding.left))
  };

  if (points.length === 0) {
    return {
      width: safeWidth,
      height: safeHeight,
      padding: safePadding,
      plotWidth: Math.max(1, safeWidth - safePadding.left - safePadding.right),
      plotHeight: Math.max(1, safeHeight - safePadding.top - safePadding.bottom),
      coords: [],
      linePath: ""
    };
  }

  const values = points.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueRange = max - min || 1;
  const total = points.length;

  const plotWidth = Math.max(1, safeWidth - safePadding.left - safePadding.right);
  const plotHeight = Math.max(1, safeHeight - safePadding.top - safePadding.bottom);

  const coords = points.map((point, index) => {
    const ratio = total === 1 ? 0.5 : index / Math.max(total - 1, 1);
    const rawX = safePadding.left + ratio * plotWidth;
    const x = Math.min(
      Math.max(rawX, safePadding.left),
      Math.max(safePadding.left, safeWidth - safePadding.right)
    );
    const y = safePadding.top + ((max - point.value) / valueRange) * plotHeight;
    return {
      x,
      y,
      point
    };
  });

  const linePath = coords
    .map((item, index) => `${index === 0 ? "M" : "L"}${item.x.toFixed(2)} ${item.y.toFixed(2)}`)
    .join(" ");

  return {
    width: safeWidth,
    height: safeHeight,
    padding: safePadding,
    plotWidth,
    plotHeight,
    coords,
    linePath
  };
}

export const defaultMetricChartPadding = DEFAULT_PADDING;
