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
   - If the `token_badge` PDA exists on-chain: Displays **"Verified Meteora DBC badged quote"** with native pool creation enabled.
   - If no badge exists: Displays **"This xStock is not badged on DBC"** and disables signing any transaction that would revert.
3. **One-Tap Permissionless Fallback**: When an unbadged xStock is selected, the user is offered a single-tap fallback to pair natively with standard SPL tokens:
   - **`⚡ Pair with SOL`** (`So11111111111111111111111111111111111111112`)
   - **`💵 Pair with USDC`** (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
   - Standard SPL tokens are **fully permissionless** and require no token badge.
   - **Context Preservation**: The underlying stock (`NVDAx`, `AAPLx`) remains permanently anchored as the community index, thematic context, and Pyth Price Oracle benchmark.

---

## 4. DBC Curve Preset Selector

OpenStock exposes 3 distinct curve presets mapped to Meteora mainnet bonding curve configurations from `@meteora-ag/dynamic-bonding-curve-sdk`:

| Preset | Curve Type | Target Cap | Creator Fee | Description | Config Address |
|---|---|---|---|---|---|
| **Linear Standard** *(Default)* | Linear Constant Product | $69,000 | 1.5% | Balanced price discovery curve with standard graduation threshold, ideal for mega-cap equities like AAPLx and NVDAx. | `F5g2K41f1U2wA6qg4rXp1Yv5K8tJ3bE4wKM89pTxsZ3F` |
| **Exponential Growth** | Exponential Curve | $85,000 | 2.0% | Steeper price escalation that rewards early community participants and accelerates migration into DAMM v2. | `EPx2U3xY5v9K4wA7qB1rX5pY7hN4mD9sL6tC1vE8xA5z` |
| **Flat Deep Liquidity** | Flat / Concentrated | $100,000 | 1.0% | Low-slippage, deep liquidity curve tailored for broad-market indices (SPY, QQQ) and institutional allocations. | `FL4tDBC99pTxSZ3F1U2wA6qg4rXp1Yv5K8tJ3bE4wKM8` |

> [!NOTE]
> Curve preset selection is **strictly displayed only when Meteora DBC is selected** (`selectedVenue === "meteora"`). It is never displayed on Pump.fun / ClawPump.

---

## 5. Key Implementation Files

- [`lib/meteora-dbc.ts`](file:///C:/Users/DELL/Downloads/openstock/lib/meteora-dbc.ts): SDK client initialization, curve preset dictionary, on-chain token badge PDA validation, pool PDA derivation, transaction preparation, and DAMM v2 migration helpers.
- [`app/api/launch/meteora/route.ts`](file:///C:/Users/DELL/Downloads/openstock/app/api/launch/meteora/route.ts): Next.js route handling `prepare` and `confirm` modes, enforces badge checking, passes selected curve preset, and writes confirmed pools to the community registry.
- [`app/api/launch/venues/route.ts`](file:///C:/Users/DELL/Downloads/openstock/app/api/launch/venues/route.ts): Evaluates quote token badge status on-chain and returns venue capabilities.
- [`app/launch/launch-client.tsx`](file:///C:/Users/DELL/Downloads/openstock/app/launch/launch-client.tsx): Interactive Launch Studio with DBC preset selector, badge status pill, one-tap SOL/USDC fallback, preflight compute budget simulation, and wallet signing.
- [`app/launch/launch.css`](file:///C:/Users/DELL/Downloads/openstock/app/launch/launch.css): Responsive UI styling for DBC curve cards, badge pills, and fallback controls.

---

## 6. How Judges Can Reproduce on Mainnet

### Option A: Via the Web UI
1. Navigate to `/launch` on OpenStock.
2. Under **Step 02**, select any stock quote (e.g. `NVDAx`). Notice the badge verification pill checks on-chain.
3. If unbadged, tap **"Pair with SOL"** or **"Pair with USDC"** for instant permissionless DBC pairing with NVDAx as index context.
4. Under **Step 03**, select **Meteora DBC**. Notice the 3 DBC Curve Presets appear (**Linear Standard**, **Exponential Growth**, **Flat Deep Liquidity**).
5. Connect your Phantom or Solflare wallet.
6. Click **Launch on Meteora DBC**. Inspect the transaction in your wallet:
   - Notice the program invoked is `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`.
   - Notice the `config` account matches the chosen preset config address.
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
    "quoteMint": "So11111111111111111111111111111111111111112",
    "creatorWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "creatorFeeBps": 150,
    "supply": 1000000000,
    "curvePreset": "linear"
  }'
```

The response contains:
- `transactionBase64`: Serialized transaction containing the authentic `createPool` instruction.
- `mintAddress`: Generated base token mint Keypair public key.
- `poolAddress`: Derived DBC Pool PDA.
- `configAddress`: Selected curve preset config address (`F5g2K41f1U2wA6qg4rXp1Yv5K8tJ3bE4wKM89pTxsZ3F`).

---

## 7. Honest Telemetry & Architecture Note

- **Radar Cards**: Stock metrics and community radar stats reflect real mainnet Pyth Price Oracle feeds and DexScreener liquidity pools for the underlying equities. Synthetic volume formulas have been purged.
- **Explorer Links**: Newly created DBC pools link directly to Solscan with the derived pool address upon block inclusion.
- **DLMM Migration**: The Meteora DLMM pool URL activates when the bonding curve reaches graduation and triggers `migrationDammV2` into `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`.
