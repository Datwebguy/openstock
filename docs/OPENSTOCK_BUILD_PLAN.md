# OpenStock Build Plan

## Recommended stack

- Next.js + React + TypeScript.
- Existing project styling system with CSS motion primitives.
- Solana wallet adapter and Token-2022 utilities when signing is brought into scope.
- Typed live adapters for xStocks, Jupiter, Pyth, Meteora, and Solana RPC.
- One issuer-logo family for stock identity; motion explains state without replacing data.

## Architecture

```text
app/
  app/
  app/asset/[symbol]/
  app/receipt/[id]/
  app/learn/multipliers/
components/
  market/
  orders/
  receipts/
  stock-logo.tsx
lib/
  xstocks.ts
  market-evidence.ts
  scaled-amounts.ts
docs/
```

## Seven-day sequence

### Day 1 — foundation

Set up the app shell, tokens, live xStocks adapter, navigation, and typed evidence interfaces. Establish issuer-logo identity and the reduced-motion rules.

### Day 2 — landing

Build the asymmetric landing page and scroll narrative: signal network → reference → liquidity → multiplier → receipt.

### Day 3 — discover and asset detail

Build live stock cards, source comparison, market phase, liquidity context, reserves, and conservative verdict states.

### Day 4 — order safety

Implement scaled UI amount conversion, multiplier notice, paper mode, and the order review surface. Keep live signing disabled.

### Day 5 — live evidence

Connect xStocks, Jupiter, Pyth metadata/Hermes, Meteora, reserves, corporate actions, and Solana RPC. Missing sources remain explicitly unavailable.

### Day 6 — receipt and polish

Build local paper receipts, the multiplier guide, responsive states, loading/error/empty states, and stock-specific choreography.

### Day 7 — hardening

Run data-integrity, accessibility, responsive, reduced-motion, and paper-order safety checks. Record a focused demo.

## Demo path

OpenStock → choose AAPLx → compare live evidence → inspect the multiplier → enter an amount when required inputs are available → review paper order → generate local receipt.

Live orders are deliberately outside this build. If a live source is unavailable, the app shows the unavailable state and blocks a confident review. It never substitutes mock prices, fake route data, or an invented transaction signature.
