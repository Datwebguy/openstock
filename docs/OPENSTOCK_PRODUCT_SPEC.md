# OpenStock Product Spec

## Promise

OpenStock helps users decide whether a tokenized stock is healthy to trade before they route an order.

## MVP route map

- `/` — landing and product story
- `/app` — discover stocks and market pulse
- `/app/asset/[symbol]` — source comparison, verdict, liquidity, and order entry
- `/app/receipt/[id]` — verifiable trade or paper-trade receipt
- `/app/learn/multipliers` — scaled UI amounts and corporate actions

## Primary flow

1. User explores without connecting a wallet.
2. User chooses AAPLx, NVDAx, SPYx, or TSLAx.
3. OpenStock loads reference price, Jupiter executable price, Pyth cross-check, Meteora liquidity, market phase, reserves, corporate actions, and multiplier state.
4. The app produces a verdict: healthy, wide spread, low liquidity, stale reference, corporate action pending, or wait.
5. User chooses buy/sell, threshold order, DCA, OCO/OTOCO, or paper trade.
6. The app revalidates data and multiplier immediately before creating the order.
7. User signs only after seeing raw amount, UI amount, route, slippage, expiry, and fees.
8. OpenStock produces a receipt with source values and transaction proof.

## Multiplier rule

```text
uiAmount = rawAmount × effectiveMultiplier
rawAmount = uiAmount ÷ effectiveMultiplier
```

The active multiplier must be applied in display formatting, validation, order construction, receipt rendering, and any pending-order recalculation. Never cache it only in the frontend.

## Verdict logic

Hard block when the reference is stale beyond policy, multiplier data is missing, quote is expired, issuer halt is active, reserves are unavailable, or price disagreement exceeds the configured safety threshold.

Soft warning when spread, impact, thin liquidity, or off-hours conditions are elevated. Every verdict shows the evidence behind it.

## Data adapters

- xStocks public API: metadata, reference prices, reserves, oracles, market status, corporate actions, multipliers, RFQ quotes.
- Jupiter: executable routes, trigger orders, DCA, OCO/OTOCO where available.
- Pyth: independent oracle cross-check.
- Meteora: pool price, TVL, volume, fees, APR, and impact context.
- Solana RPC: Token-2022 mint/account data and transaction confirmation.

Adapters must be replaceable and return normalized data to the verdict engine.

## Non-goals

- Not an investment adviser or price prediction engine.
- Not a generic AI trading agent.
- Not a new AMM, lending protocol, social copy-trading app, or themed basket.
- No live trading before paper mode and safety validation work.
