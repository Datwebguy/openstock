# OpenStock Character + Motion Spec

## Character family

### Bellwether — guide

An observatory bell with a visor and signal antenna. Calm, observant, lightly witty. Guides onboarding, verdicts, and order review.

### Scout — data inspector

A satellite/compass that checks reference, executable, and oracle prices. Curious and precise.

### Flux — liquidity

A translucent river-like character that visualizes depth, impact, TVL, and spread. Fluid but cautious.

### Split — corporate actions

A two-panel character that reconfigures when a split, dividend, or multiplier update is pending. Methodical and educational.

### Receipt — proof

A folded trade receipt that reveals timestamp, source values, multiplier, route, and signature. Celebrates verification, never profit.

## Art direction

- 2D-first, layered vector or high-resolution raster; 3D-ready silhouettes.
- Use observatory instruments, signals, bells, charts, receipts, and liquidity flows rather than animal mascots.
- Matte bodies, one translucent data material, one hard instrument detail, one signal accent.
- Characters must remain credible and must never imply guaranteed returns or price direction.
- Do not copy Daybreak silhouettes, poses, phrases, or compositions.

## Shared states

`idle`, `observing`, `aligned`, `uncertain`, `blocked`, `ready`, `confirmed`, and `reduced-motion`.

Important states always have text equivalents. Characters enhance understanding; they never replace warnings.

## Landing choreography

| Scroll zone | Character | Action |
|---|---|---|
| 0–15% | Bellwether | enters as the promise resolves |
| 15–30% | Scout | traces the three-source comparison |
| 30–48% | Flux | settles into liquidity depth and changes posture |
| 48–66% | Split | demonstrates raw amount to UI amount |
| 66–84% | Bellwether | becomes a visual guardrail during order review |
| 84–100% | Receipt | unfolds into verifiable proof |

The landing page should feel like one guided expedition, not unrelated mascot cards.

## App behavior

- Characters animate on meaningful events, not on every scroll tick.
- Selected assets may show richer motion; unselected stock cards remain quiet.
- Verdict states are visually distinct but data-led.
- Order review uses a calm sequence: intent → source prices → multiplier → impact → route → sign.
- Receipt animation settles quickly so transaction data remains primary.

## Motion tokens

```css
--ob-ease-standard: cubic-bezier(.2, .8, .2, 1);
--ob-ease-emphasis: cubic-bezier(.16, 1, .3, 1);
--ob-duration-fast: 160ms;
--ob-duration-standard: 420ms;
--ob-duration-slow: 760ms;
--ob-float-distance: 8px;
--ob-reveal-distance: 20px;
```

Use `motion/react`, `useScroll`, and motion values. Do not put continuous scroll or pointer state in React state. No critical text, prices, warnings, or signing controls move with parallax.

## Component contract

```ts
type OpenStockCharacter = "bellwether" | "scout" | "flux" | "split" | "receipt";
type CharacterState = "idle" | "observing" | "aligned" | "uncertain" | "blocked" | "ready" | "confirmed";

type CharacterProps = {
  character: OpenStockCharacter;
  state: CharacterState;
  label?: string;
  reducedMotion?: boolean;
  decorative?: boolean;
};
```

## Acceptance criteria

- Recognizable at 32px and expressive at hero scale.
- Every important status understandable without the character.
- Reduced motion preserves the same information hierarchy.
- 2D assets can later become a coherent low-poly/soft 3D system.
