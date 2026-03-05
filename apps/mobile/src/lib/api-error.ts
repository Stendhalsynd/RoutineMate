export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const text = error.message.toLowerCase();
  return text.includes("network request failed") || text.includes("failed to fetch") || text.includes("networkerror");
}

export function toUserFacingErrorMessage(error: unknown, fallback: string): string {
  if (isTransientNetworkError(error)) {
    return "네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
