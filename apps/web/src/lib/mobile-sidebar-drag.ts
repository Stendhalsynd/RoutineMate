export function clampSidebarOffset(offset: number, width: number): number {
  if (offset > 0) {
    return 0;
  }
  if (offset < -width) {
    return -width;
  }
  return offset;
}

export function decideSidebarState(offset: number, velocityX: number, width: number): "open" | "closed" {
  if (velocityX >= 0.8) {
    return "open";
  }
  if (velocityX <= -0.8) {
    return "closed";
  }
  return offset >= -width / 2 ? "open" : "closed";
}
