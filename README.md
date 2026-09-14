# OpenStock

OpenStock is a clear market-context layer for tokenized stocks on Solana.

The app uses live xStocks data and public market sources to show issuer identity, price context, market phase, liquidity, reserves, company updates, and share adjustments. It does not invent values when a source is still loading.

## Implemented

- Live xStocks issuer data, reference prices, market phase, reserve data, oracle metadata, company updates, and share adjustments.
- Jupiter market quotes, Meteora liquidity context, and optional Pyth price checks.
- Share amount calculations that stay aligned with the current issuer adjustment.
- A stock-logo network on the homepage and stock-specific motion on asset details.
- Live order preparation through Jupiter Swap API v2, with a user-owned Phantom or Solflare wallet signing boundary. OpenStock never creates, stores, or controls wallets.
- Onchain context remains available outside issuer reference hours; the UI labels official reference data separately from executable or indicative Solana quotes.
- Local review records at `/app/receipt/[id]`, live receipt/history views at `/app/orders` and `/app/receipts`, wallet settings at `/app/you`, and a plain-language share-adjustment guide at `/app/learn/multipliers`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` when changing data sources. `PYTH_HERMES_API_KEY` is optional. Set `JUPITER_API_KEY` only when you are ready to enable server-side live route preparation and execution; no key means the app remains browse-only and will not request a signature.

The app does not ship with a wallet, private key, seed phrase, or funded account. A user must explicitly connect an existing wallet and approve each transaction.

## Checks

```bash
npm run build
npm run typecheck
```

The browser checklist is in `docs/OPENSTOCK_QA_CHECKLIST.md`.
