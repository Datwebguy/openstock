# OpenStock

OpenStock is a clear market-context layer for tokenized stocks on Solana.

The app uses live xStocks data and public market sources to show issuer identity, price context, market phase, liquidity, reserves, company updates, and share adjustments. It does not invent values when a source is still loading.

## Implemented

- Live xStocks issuer data, reference prices, market phase, reserve data, oracle metadata, company updates, and share adjustments.
- Jupiter market quotes, Meteora liquidity context, and optional Pyth price checks.
- Share amount calculations that stay aligned with the current issuer adjustment.
- Listed xStock names on the homepage, linked into the live market.
- Live order preparation through Jupiter Swap API v2 only when `JUPITER_API_KEY` is set. Without it, the desk stays browse-only and saves paper reviews locally. Signing happens in the user's Phantom or Solflare wallet. OpenStock never creates, stores, or controls wallets.
- Onchain context remains available outside issuer reference hours; the UI labels official reference data separately from executable or indicative Solana quotes.
- Local review records at `/app/receipt/[id]`, history at `/app/activity`, wallet and holdings at `/app/wallet`, and a plain-language share-adjustment guide at `/app/learn/multipliers`. `/app/orders` and `/app/receipts` redirect to Activity.
- One wallet session across market, orders, automation, and holdings. Connect once; the same address is reused until you disconnect.
- Automation review lives at `/app/automation/review` after you press **Review rule**. It is not a separate nav item.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` when changing data sources. `PYTH_HERMES_API_KEY` is optional. Set `JUPITER_API_KEY` only when you are ready to enable server-side live route preparation and execution; no key means the app remains browse-only and will not request a signature. Set `NEXT_PUBLIC_PRIVY_APP_ID` to add email login beside Phantom and Solflare.

The app does not ship with a wallet, private key, seed phrase, or funded account. A user must explicitly connect an existing wallet and approve each transaction.

## Checks

```bash
npm run build
npm run typecheck
npm test
```

The browser checklist is in `docs/OPENSTOCK_QA_CHECKLIST.md`.
