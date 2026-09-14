# OpenStock Design System

## Tokens

```css
:root {
  --ob-blue: #2b5bff;
  --ob-blue-deep: #1027c9;
  --ob-ink: #17213a;
  --ob-muted: #66718a;
  --ob-porcelain: #f5f7fc;
  --ob-surface: #ffffff;
  --ob-line: #e5eaf4;
  --ob-cyan: #78d9ff;
  --ob-positive: #16866a;
  --ob-warning: #b87916;
  --ob-danger: #c74747;
  --ob-night: #0b1020;
  --ob-night-surface: #151d34;
  --ob-radius-card: 24px;
  --ob-radius-control: 16px;
  --ob-radius-pill: 999px;
  --ob-ease: cubic-bezier(.2, .8, .2, 1);
}
```

Typography uses a rounded display face for headlines, Geist for interface/body text, and Geist Mono for contracts, timestamps, prices, and signatures. Self-host fonts with `next/font` or `@font-face`.

## Layout

- Landing: asymmetric split compositions, large display type, one primary action per section.
- App: floating shell, live market pulse rail, structured content column, verdict-first asset detail.
- Desktop content max width: 1280–1400px.
- Mobile: no horizontal page overflow; bottom navigation is a floating sticky pill.
- Cards use one soft radius system; pills are reserved for navigation, filters, and status.

## Core components

- `OpenStockShell`
- `MarketPulseRail`
- `VerdictCard`
- `SourceComparison`
- `AssetTile`
- `LiquidityPanel`
- `MultiplierNotice`
- `OrderIntentSheet`
- `ReceiptCard`
- `Character`

## Motion

- Use `motion/react` for sequences and motion values for scroll progress.
- Use short reveal/stagger transitions, restrained drift, and event-driven character animation.
- Never move critical price, warning, or signing controls with parallax.
- Never use animation to imply price direction.
- Respect `prefers-reduced-motion` with static states and equivalent text.

## Accessibility

- Visible focus rings and keyboard-complete flows.
- Text equivalents for every status represented by a character or color.
- Strong contrast in light and dark themes.
- Dialog focus trapping and Escape dismissal.
- Buttons state what will happen: `Review quote`, `Place paper order`, `Sign live order`.
