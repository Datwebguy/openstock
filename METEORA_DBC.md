# Meteora Dynamic Bonding Curve (DBC) Integration Guide

> **OpenStock × Meteora Crypto World's Fair DBC Sidetrack**  
> Technical documentation, on-chain program architecture, reproducible judge verification steps, and token badge constraints.

---

## 1. On-Chain Program Identifiers

OpenStock integrates directly with Meteora's production Solana mainnet smart contracts:

| Component | Program / Contract Address | Description |
|---|---|---|
| **Meteora Dynamic Bonding Curve (DBC)** | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` | Virtual pool initialization, curve pricing, token minting, and trading |
| **Meteora Dynamic AMM (DAMM v2)** | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` | Permanent concentrated liquidity migration target upon graduation |
| **Metaplex Token Metadata** | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` | On-chain token name, symbol, and image URI registration |
| **Solana SPL Token Program** | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Standard token program for permissionless base and quote assets |

---

## 2. End-to-End Architecture: Prepare / Sign / Confirm

OpenStock strictly follows a non-custodial, wallet-native execution lifecycle. **Zero mock transfers (`lamports: 0`) and zero synthetic redirects.**

```
[User Browser / Wallet]
       │
       │ 1. POST /api/launch/meteora (mode: "prepare", quoteMint, curvePreset, supply, fees)
       ▼
[OpenStock API Server]
       │
       │ Calls @meteora-ag/dynamic-bonding-curve-sdk
       │ Derives DBC Pool PDA, Authority, Token Vaults, Fee Accounts
       │ Builds createPool / initializeVirtualPoolWithSplToken instruction
       │ Injects ComputeBudget priority fees
       ▼
[User Browser / Wallet]
       │
       │ 2. Deserializes Base64 Transaction
       │ Runs local preflight simulation against Solana RPC
       │ User reviews & signs authentic DBC transaction in Phantom / Solflare
       │ Broadcasts signed transaction to Solana Cluster
       ▼
[Solana Mainnet-Beta]
       │
       │ Executes Dynamic Bonding Curve Program (dbcij3...aqN)
       │ Mints token supply, initializes virtual reserves & bonding curve
       ▼
[User Browser / Wallet]
       │
       │ 3. POST /api/launch/meteora (mode: "confirm", txSignature, mintAddress, poolAddress)
       ▼
[OpenStock Registry]
       │ Verifies block inclusion on-chain
       │ Stores real pool address + mint into live community index
```

---

## 3. Token-2022 Badge Constraint & Permissionless Fallback Rule

### The On-Chain Constraint
In Meteora DBC, quote tokens that use the **Token-2022 Program** (such as tokenized equities: `NVDAx`, `AAPLx`, `TSLAx`) require an on-chain **Token Badge PDA**:
$$\text{PDA} = \text{PublicKey.findProgramAddressSync}([\text{"token\_badge"}, \text{quoteMint}], \text{DYNAMIC\_BONDING\_CURVE\_PROGRAM\_ID})$$

If a Token-2022 quote token does not have an initialized `token_badge` account created by Meteora protocol operators, the Anchor program will immediately revert with error `InvalidTokenBadge` (or `AccountNotInitialized`).

### OpenStock Implementation Policy
1. **Never Invent Badges**: OpenStock never fakes badge accounts or uses mock verification.
2. **On-Chain Preflight Badge Check**: Before transaction construction, OpenStock calls `checkMeteoraDbcBadgeSupport(quoteMint)` against the Solana mainnet RPC:
   - If the `token_badge` PDA exists on-chain: Meteora DBC launch against that **xStock** is enabled.
   - If no badge exists: Meteora DBC is disabled for that stock. The user launches against the same xStock on Pump.fun, or picks a badged xStock.
3. **Quote asset is always an xStock**: OpenStock does not pair community tokens against SOL or USDC. The product is tokenized-stock pairs (`YOUR_TOKEN × NVDAx`), not SOL/USDC markets.

---

## 4. DBC Curve Preset Selector

OpenStock exposes 3 distinct curve presets mapped to Meteora mainnet bonding curve configurations from `@meteora-ag/dynamic-bonding-curve-sdk`:

| Preset | Curve Type | Target Cap | Creator Fee | Description |
|---|---|---|---|---|
| **Equity Standard** *(Default)* | Linear | $69,000 | 1.5% | Balanced TOKEN×xStock discovery for mega-caps (NVDAx, AAPLx). Fees quote in the paired stock. |
| **Equity Momentum** | Exponential | $85,000 | 2.0% | Steeper early discovery for high-attention stock pairs; accelerates DAMM graduation. |
| **Equity Deep Book** | Flat | $100,000 | 1.0% | Lower-slippage curve for broad names (SPYx, QQQx) where depth matters more than speed. |

> [!NOTE]
> Curve preset selection is **strictly displayed only when Meteora DBC is selected** (`selectedVenue === "meteora"`). It is never displayed on Pump.fun / ClawPump. PoolConfig accounts are resolved from on-chain configurations initialized via `@meteora-ag/dynamic-bonding-curve-sdk`.

---

## 5. Key Implementation Files

- [`lib/meteora-dbc.ts`](file:///C:/Users/DELL/Downloads/openstock/lib/meteora-dbc.ts): SDK client initialization, curve preset dictionary, on-chain token badge PDA validation, pool PDA derivation, transaction preparation, and DAMM v2 migration helpers.
- [`app/api/launch/meteora/route.ts`](file:///C:/Users/DELL/Downloads/openstock/app/api/launch/meteora/route.ts): Next.js route handling `prepare` and `confirm` modes, enforces badge checking, passes selected curve preset, and writes confirmed pools to the community registry.
- [`app/api/launch/venues/route.ts`](file:///C:/Users/DELL/Downloads/openstock/app/api/launch/venues/route.ts): Evaluates quote token badge status on-chain and returns venue capabilities.
- [`app/launch/launch-client.tsx`](file:///C:/Users/DELL/Downloads/openstock/app/launch/launch-client.tsx): Interactive Launch Studio with DBC preset selector, xStock badge status, Pump.fun fallback for unbadged stocks, preflight compute budget simulation, and wallet signing.
- [`app/launch/launch.css`](file:///C:/Users/DELL/Downloads/openstock/app/launch/launch.css): Responsive UI styling for DBC curve cards, badge pills, and fallback controls.

---

## 6. How Judges Can Reproduce on Mainnet

### Option A: Via the Web UI
1. Navigate to `/launch` on OpenStock.
2. Under **Step 02**, select any stock quote (e.g. `NVDAx`). Notice the badge verification pill checks on-chain.
3. If unbadged, Meteora DBC is unavailable for that stock. Launch against the same xStock on Pump.fun, or pick a badged stock.
4. Under **Step 03**, select **Meteora DBC** when the stock is badged. Notice the 3 equity-tuned DBC Curve Presets appear (**Equity Standard**, **Equity Momentum**, **Equity Deep Book**).
5. Connect your Phantom or Solflare wallet.
6. Click **Launch on Meteora DBC**. Inspect the transaction in your wallet:
   - Notice the program invoked is `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`.
   - Notice the `config` account is an authentic on-chain Meteora DBC PoolConfig.
   - Notice there are **no mock transfers or 0-lamport transfers**.

### Option B: Via HTTP API Inspection
Inspect the prepared transaction directly using `curl`:

```bash
curl -X POST http://localhost:3000/api/launch/meteora \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "prepare",
    "name": "Judge Token",
    "symbol": "JUDGE",
    "description": "Verification test for Meteora Crypto Worlds Fair sidetrack",
    "imageUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
    "quoteMint": "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    "creatorWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "creatorFeeBps": 150,
    "supply": 1000000000,
    "curvePreset": "linear"
  }'
```

> `quoteMint` must be a verified xStock (example above = NVDAx). SOL/USDC quote mints are rejected by the API.

The response contains:
- `transactionBase64`: Serialized transaction containing the authentic `createPool` instruction.
- `mintAddress`: Generated base token mint Keypair public key.
- `poolAddress`: Derived DBC Pool PDA.
- `configAddress`: Selected curve preset config address.

---

## 7. Honest Telemetry & Architecture Note

- **Radar Cards**: Stock metrics and community radar stats reflect real mainnet Pyth Price Oracle feeds and DexScreener liquidity pools for the underlying equities. Synthetic volume formulas have been purged.
- **Explorer Links**: Newly created DBC pools link directly to Solscan with the derived pool address upon block inclusion.
- **DLMM Migration**: The Meteora DLMM pool URL activates when the bonding curve reaches graduation and triggers `migrationDammV2` into `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`.
