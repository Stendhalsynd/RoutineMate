export function issueRequestSequence(previous: number): number {
  return previous + 1;
}

export function shouldApplyRequestSequence(latest: number, candidate: number): boolean {
  return latest === candidate;
}

export function computeMutationRefreshDelay(lastMutationAt: number, now: number, debounceMs = 250): number {
  return Math.max(0, debounceMs - Math.max(0, now - lastMutationAt));
}
