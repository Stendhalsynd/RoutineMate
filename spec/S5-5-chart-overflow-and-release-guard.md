# S5-5 Chart Overflow And Release Guard

## Scope
- Fix chart overflow in body metric trend cards (mobile first, web hardening).
- Prevent preview/debug APK from being uploaded as release assets.

## Problem Statement
- Mobile chart width is derived from viewport (`viewportWidth - 86`) instead of actual card container width.
- Right-side labels and chart internals can render outside card boundaries on narrow screens.
- Release upload flow currently accepts preview/debug APK paths and can cause distribution mistakes.

## Requirements
- Measure chart width from real container layout and render chart strictly within that width.
- Keep visual clipping at chart wrapper level (`overflow: hidden` + radius) to avoid external bleed.
- Keep chart library unchanged (`react-native-chart-kit`).
- Keep Google session persistence behavior unchanged.
- Reject preview/debug artifacts in `scripts/release-apk.sh`; release APK only.
- Width invariant: computed chart width must not exceed measured container width.

## Non-Goals
- No public API contract changes.
- No server/domain schema changes.
- No replacement of chart library.

## Test Cases
- Mobile width decision tests:
  - Legacy formula can exceed available content width.
  - Container-based width always fits available content width.
  - Boundary behavior is deterministic for `0/1/119/120/121`.
- Mobile UI behavior:
  - Body metric charts stay within card bounds at widths `320/360/390/768`.
- Web regression:
  - Chart SVG does not visually bleed outside card on narrow view.
- Release guard:
  - `release-apk.sh` fails for preview/debug APK path.
  - `release-apk.sh` passes for release APK path.

## Acceptance Criteria
- No chart overflow outside card boundaries on mobile and web.
- Existing auth/session restore flow is unchanged.
- Release upload script blocks preview/debug APK artifacts by default.
