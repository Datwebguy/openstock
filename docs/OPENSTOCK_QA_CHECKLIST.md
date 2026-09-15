# OpenStock QA Checklist

## Browser and visual

- Test landing and app at 375, 768, 1440 widths.
- Test light and dark modes (nav Dark/Light control, or `prefers-color-scheme`).
- Test keyboard navigation, focus, Escape, and dialog focus trapping.
- Test `prefers-reduced-motion`.
- Check no horizontal overflow or sticky navigation obstruction.
- Confirm characters do not cover prices, warnings, or signing controls.

## Data integrity

- Official reference price has source and timestamp.
- Jupiter executable quote has route, expiry, slippage, and fees.
- Pyth cross-check shows freshness and deviation.
- Meteora liquidity and impact are clearly labeled as pool data.
- Market phase, halt, reserve, corporate action, and multiplier statuses are visible.
- Missing or stale data produces a safe state, not a fake green state.

## Amount safety

- UI amount and raw Token-2022 amount are both testable.
- Active multiplier is applied at display and order layers.
- Pending orders recalculate or stop when the multiplier changes.
- Amount conversion is revalidated immediately before submission.
- Receipt records both user-facing and raw amounts.

## Order safety

- Paper mode is the default when `JUPITER_API_KEY` is unset. Live signing is disabled until that key is present.
- Live order requires explicit user intent and wallet signature.
- Expired quotes cannot be submitted.
- Hard-block states cannot be bypassed through animation or keyboard shortcuts.
- No fake transaction signatures or fake live quotes.

## Character and motion

- Animation never implies price direction or guaranteed return.
- Character status has equivalent text.
- Reduced-motion mode removes loops and parallax while preserving state.
- Landing scroll has a coherent beginning, middle, and end.
- Receipt animation yields focus to proof fields.
