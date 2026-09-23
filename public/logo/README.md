# OpenStock Brand Assets & Logo Kit

The official brand identity, logo files, and iconography for **OpenStock: The Solana Equity Protocol**.

## Folder Location
- **Local Filesystem**: `public/logo/`
- **Web App Static URL**: `/logo/[filename]` (served from `/public`)

---

## Asset Index

### 1. Master Icons & Favicons
| File | Format | Dimensions | Purpose / Usage |
| :--- | :---: | :---: | :--- |
| `openstock-icon.svg` | SVG | 512 × 512 | Master scalable app icon with night background & ambient glow |
| `openstock-icon.png` | PNG | 512 × 512 | High-res raster icon for mobile apps, wallets, social profiles |
| `openstock-icon-transparent.svg` | SVG | 512 × 512 | Vector circular icon with no background box |
| `openstock-icon-transparent.png` | PNG | 512 × 512 | Circular icon on transparent background |
| `openstock-badge-mark.svg` | SVG | 128 × 128 | The signature asymmetrical squircle badge with celestial `◒` mark |
| `openstock-badge-mark.png` | PNG | 256 × 256 | Asymmetrical badge mark raster export |
| `openstock-symbol-gradient.svg` | SVG | 128 × 128 | Pure celestial eclipse `◒` vector glyph in Solana gradient |
| `favicon.svg` | SVG | 64 × 64 | Web browser tab favicon |

### 2. Horizontal Logos (Banners, Headers & Navbars)
| File | Format | Dimensions | Purpose / Usage |
| :--- | :---: | :---: | :--- |
| `openstock-logo-horizontal-dark.svg` | SVG | 540 × 120 | Full lockup with dark night background (`#07070D`) |
| `openstock-logo-horizontal-dark.png` | PNG | 1080 × 240 (@2x) | Retina banner for dark pitch decks, docs, and headers |
| `openstock-logo-horizontal-light.svg` | SVG | 540 × 120 | Full lockup with clean white background (`#FFFFFF`) |
| `openstock-logo-horizontal-light.png` | PNG | 1080 × 240 (@2x) | Retina banner for light backgrounds and printable media |
| `openstock-logo-horizontal-transparent.svg`| SVG | 500 × 80 | Transparent horizontal lockup for direct web embedding |
| `openstock-logo-horizontal-transparent.png`| PNG | 1000 × 160 (@2x) | Transparent raster banner |

### 3. Vertical & Square Lockups (Avatars & Badges)
| File | Format | Dimensions | Purpose / Usage |
| :--- | :---: | :---: | :--- |
| `openstock-logo-vertical-dark.svg` | SVG | 360 × 360 | Centered stacked logo for dark avatars, square tiles |
| `openstock-logo-vertical-dark.png` | PNG | 720 × 720 (@2x) | Square dark profile picture / avatar |
| `openstock-logo-vertical-light.svg` | SVG | 360 × 360 | Centered stacked logo for light mode presentation |
| `openstock-logo-vertical-light.png` | PNG | 720 × 720 (@2x) | Square light profile picture / avatar |

---

## Brand Color Palette

| Color Name | Hex Code | RGB | Role / Usage |
| :--- | :---: | :---: | :--- |
| **Night (Background)** | `#07070D` | `rgb(7, 7, 13)` | Primary dark canvas, card background, border fills |
| **Solana Purple** | `#9945FF` | `rgb(153, 69, 255)` | Primary gradient start, accents, badges |
| **Solana Cyan / Blue** | `#03E1FF` | `rgb(3, 225, 255)` | Gradient midpoint, active links, glow effects |
| **Solana Green** | `#14F195` | `rgb(20, 241, 149)` | Gradient end, positive yields, liquidity indicators |
| **Light Canvas** | `#FFFFFF` | `rgb(255, 255, 255)` | Light mode background |
| **Slate Ink (Text)** | `#07070D` | `rgb(7, 7, 13)` | Primary text in light mode |
| **Pure White (Text)** | `#FFFFFF` | `rgb(255, 255, 255)` | Primary text in dark mode |
| **Muted Slate** | `#94A3B8` | `rgb(148, 163, 184)` | Secondary copy, protocol subtitles |

### Solana Gradient CSS
```css
background: linear-gradient(135deg, #9945FF 0%, #03E1FF 50%, #14F195 100%);
```

---

## Typography Guidelines
- **Wordmark**: Geometric sans-serif with bold weight (`font-weight: 800`), slight negative tracking (`letter-spacing: -0.03em`).
- **Protocol Subtitle**: Uppercase tracking (`letter-spacing: 0.22em`), medium/semibold (`font-weight: 700`).
- **Brand Mark Symbol**: `◒` (Circle with upper black hemisphere, lower white hemisphere / celestial eclipse).
