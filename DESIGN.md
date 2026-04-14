# RoutineMate Design System

## North Star
- Style: Neo Brutalism for a habit-tracking product that should feel punchy, immediate, and unmistakably tactile.
- Mood: Cheerful accountability, bold utility, zero glassmorphism.
- Rule: Prefer loud contrast, hard edges, visible borders, and offset shadows over subtle gradients and blur.

## Visual Principles
- Use cream or warm paper backgrounds instead of pure white.
- Every interactive surface needs a visible outline.
- Shadows should read as physical offsets, not soft ambient haze.
- Highlight states should be obvious in one glance.
- Numbers and check states are the primary content, so never let decoration reduce legibility.

## Color Tokens
- `canvas`: `#fff4cc`
- `canvas-accent`: `#ffe16a`
- `surface`: `#fffdf7`
- `surface-strong`: `#ffffff`
- `ink`: `#111111`
- `ink-muted`: `#3f3a33`
- `brand`: `#ffd43b`
- `brand-ink`: `#111111`
- `mint`: `#7ce3b4`
- `sky`: `#84b6ff`
- `danger`: `#ff7b7b`

## Shape And Depth
- Default corner radius: 18px on cards, 14px on controls.
- Default border width: 2px.
- Default shadow: `4px 4px 0 0 #111111`.
- Interactive hover/press should feel like a paper card shifting, not fading.

## Typography
- Prefer heavy display treatment for titles and KPI values.
- Body copy stays simple, high-contrast, and compact.
- Numeric UI should preserve one-decimal precision without visual clutter.

## Layout
- Cards stack with clear separation and no low-contrast dividers.
- Navigation chips and segmented controls should look like physical tabs.
- Empty states should use direct language, not soft marketing copy.

## Component Rules
- Buttons: solid fills, black borders, offset shadows, no pill-only aesthetic by default.
- KPI cards: bold label/value separation with visible framing.
- Pickers: selected zone must always preserve number legibility.
- Forms: input labels and placeholders stay readable against the canvas.

## Motion
- Keep transitions short and snappy: `120ms` to `180ms`.
- Prefer translate/scale cues over opacity-only changes.

## Implementation Mapping
- `packages/ui/src/tokens.ts` is the single source for shared mobile/web token values.
- `apps/web/app/globals.css` mirrors those tokens through CSS custom properties.
- New visual work should update this document first, then token files, then component code.
