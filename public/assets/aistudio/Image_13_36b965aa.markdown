---
name: Bio-Trace Agritech
colors:
  surface: '#f7faf5'
  surface-dim: '#d8dbd6'
  surface-bright: '#f7faf5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4ef'
  surface-container: '#ecefea'
  surface-container-high: '#e6e9e4'
  surface-container-highest: '#e0e3de'
  on-surface: '#191c1a'
  on-surface-variant: '#41493f'
  inverse-surface: '#2d312e'
  inverse-on-surface: '#eff2ec'
  outline: '#71796e'
  outline-variant: '#c1c9bb'
  surface-tint: '#356a33'
  primary: '#003206'
  on-primary: '#ffffff'
  primary-container: '#144a17'
  on-primary-container: '#81ba7a'
  inverse-primary: '#9bd592'
  secondary: '#1b6d24'
  on-secondary: '#ffffff'
  secondary-container: '#a0f399'
  on-secondary-container: '#217128'
  tertiary: '#3c241c'
  on-tertiary: '#ffffff'
  tertiary-container: '#553930'
  on-tertiary-container: '#caa397'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b6f2ac'
  primary-fixed-dim: '#9bd592'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#1c511d'
  secondary-fixed: '#a3f69c'
  secondary-fixed-dim: '#88d982'
  on-secondary-fixed: '#002204'
  on-secondary-fixed-variant: '#005312'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#e7bdb1'
  on-tertiary-fixed: '#2c160e'
  on-tertiary-fixed-variant: '#5d4037'
  background: '#f7faf5'
  on-background: '#191c1a'
  surface-variant: '#e0e3de'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies the intersection of modern agricultural technology, circular bio-economy principles, and high-trust digital commerce. Drawing visual cues from the Black Soldier Fly (BSF) frass and organic soil revitalisation narrative, the visual language balances grounded, natural earthiness with high-tech verification precision.

The design movement combines **Contemporary Clean SaaS** with subtle **Tactile Organic Warmth**. It eschews sterile, cold tech tropes in favor of lush vegetal greens, rich soil browns, and crisp organic off-whites. Interfaces are structured to instill institutional trust in commercial buyers, smallholder farmers, and enterprise agricultural partners. Key design tenets prioritize data clarity, batch-traceability visibility, and rapid field ergonomics (such as high legibility under direct sunlight, prominent touch targets, and unmistakable verification badges).

## Colors

The color palette directly references the living lifecycle of organic frass fertilizers: deep canopy greens, active sprout greens, and rich organic compost soil.

- **Primary (`#144A17` - Canopy Deep Green):** Anchor tone for top app bars, primary actions, critical navigation anchors, and formal trust headers.
- **Secondary (`#2E7D32` - Leaf Vibrant Green):** Used for interactive positive states, conversion buttons, progress milestones, and verified certification badges.
- **Tertiary (`#5D4037` - Humus Soil Brown):** Earthy accent for packaging tags, batch metadata, product formulation markers, and soil nutritional charts.
- **Neutral Surface Palette:**
  - Base Background: `#F9FBF7` (Clean Organic Cream) delivers warm softness without the harsh glare of pure white.
  - Surface Card: `#FFFFFF` (Pure Bright White) ensures contrast against background tiers.
  - Borders & Dividers: `#E3E8DF` (Muted Moss Gray) for low-contrast structure.
  - Text Primary: `#1C241D` (Deep Bio Charcoal); Text Secondary: `#5B665C` (Forest Fog).
- **Verification & Status Accents:**
  - Blockchain/QR Verified Badge: `#0F5132` surface with `#D1E7DD` contrast ring.
  - Warm Earth Highlights (Mascot Hat/Sun Tone): `#F9A825` used sparingly for alert banners and review star ratings.

## Typography

The type scale combines **Plus Jakarta Sans** for headlines and interactive elements with **Inter** for dense transactional, technical, and analytical content.

- **Plus Jakarta Sans** injects welcoming geometric curves, matching the organic theme while retaining crisp executive structure. It handles titles, metric cards, navigation headers, and badge micro-labels.
- **Inter** provides neutral, utilitarian legibility for marketplace product descriptions, QR payload records, nutrient data sheets, and invoice line items.
- Numeric displays on marketplace pricing and traceability IDs benefit from tabular figure alignments (`font-variant-numeric: tabular-nums`) to preserve column rhythm.

## Layout & Spacing

The layout is built around an **8-point fluid-responsive grid**:

- **Mobile Viewports (<640px):** 4-column layout with `1rem` outer margins and `1rem` column gutters. Core interaction paths conform to an ergonomic 48px minimal touch-target envelope.
- **Tablet / Field Slates (640px - 1024px):** 8-column layout with `1.5rem` margins and gutters, accommodating side-by-side product comparisons and ledger tables.
- **Desktop / B2B Portal (>1024px):** 12-column layout maxing out at `1280px` centered canvas, utilizing `2.5rem` canvas margins and `1.5rem` gutters.

Component internals adhere strictly to standard spacing intervals: badges and chips use `space-xs` vertical by `space-sm` horizontal padding; marketplace catalog cards utilize `space-md` internal cushioning; complex order receipts and traceability cards scale up to `space-lg`.

## Elevation & Depth

Visual hierarchy relies on **organic tonal separation** augmented by **diffused botanical drop shadows**:

- **Level 0 (Flat Ground):** `#F9FBF7` base page canvas with no elevation.
- **Level 1 (Card & Modular Modules):** `#FFFFFF` surfaces bounded by a hairline border (`1px solid #E3E8DF`) and a subtle downward cast: `0 2px 6px -1px rgba(20, 74, 23, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.03)`.
- **Level 2 (Interactive Flyouts & Filter Tabs):** `0 8px 16px -4px rgba(20, 74, 23, 0.08), 0 4px 8px -2px rgba(93, 64, 55, 0.04)`.
- **Level 3 (Modal Dialogs, QR Scanner Overlays, Floating Action Menus):** `0 20px 24px -6px rgba(20, 74, 23, 0.12), 0 8px 12px -4px rgba(0, 0, 0, 0.06)`.
- **Mobile Bottom Navigation Bar:** Sits pinned with a subtle top hairline border (`#E3E8DF`) backed by `rgba(255, 255, 255, 0.94)` with an `8px` backdrop blur to allow background content to pass softly beneath.

## Shapes

The shape scale is set to **Level 2 (Rounded)**, balancing natural softness with industrial software precision:

- **Base Elements (0.5rem / 8px):** Standard input fields, verification table cells, dropdown lists, and metric containers.
- **Enclosed Cards (`rounded-lg` / 1rem / 16px):** Catalog product items, batch trace summary cards, and blockchain audit certificates.
- **Floating Containers (`rounded-xl` / 1.5rem / 24px):** Dialog sheets, bottom drawer pull-ups, and hero promo banners.
- **Full Pill (`rounded-full` / 9999px):** Exclusively reserved for status badges (e.g., "100% Organic", "BSF Derived", "Batch Verified"), segment filter tabs, and floating quick-action buttons.

## Components

### Buttons & Interactive Triggers
- **Primary CTA:** Filled with Canopy Deep Green (`#144A17`), white bold text, `rounded-lg` border radius, and active elevation. Hover state shifts to `#1B5E20`.
- **Secondary Action:** Transparent fill with `1.5px` border in `#2E7D32`, leaf green text.
- **Tonal Soil Pill:** Subtle `#EFEBE9` background with `#5D4037` text for secondary batch lookups and sample requests.

### Badges & Verification Tags
- **Blockchain Verified Tag:** Pill-shaped badge featuring an icon lock/chain glyph. Uses deep forest green background (`#144A17`) with high-contrast emerald text (`#A5D6A7`), signaling cryptographically verified provenance.
- **QR Traceability Chip:** High-contrast outlined pill with QR miniature icon, `#5D4037` border, cream fill (`#F9FBF7`), and soil-brown typography.

### Marketplace Cards
- **Product Card:** Pure white background, `1px solid #E3E8DF` border, `16px` corner radius. Upper portion features full-bleed organic crop or packaging photography, followed by product grade badge, title, NPK nutrient ratio tags, price per metric ton/bag, and an instant "Add to Order" action.

### Input Fields & Controls
- **Text Inputs:** Height 48px, background `#FFFFFF`, border `1.5px solid #D7DED3`, `8px` radius. Focus state displays a `2px` ring in `#2E7D32` with a `2px` transparent offset.
- **Checkboxes & Radios:** Curved square (`4px` radius) or circle, `#144A17` fill when selected with crisp white check/dot mark.

### Interactive Navigation & Tabs
- **Segmented Filter Tabs:** Horizontal scrollable rail of pill tabs (`rounded-full`). Unselected state: transparent with subtle `#5B665C` label. Active state: `#144A17` solid fill with white text.
- **Mobile Bottom Navigation Bar:** Ergonomic 64px fixed bar with 5 destinations: *Marketplace*, *Trace/Scan*, *Farm Orders*, *Nutrient Lab*, *Profile*. The central *Trace/Scan* icon is housed in a prominent floating pill container colored in `#2E7D32` to encourage field scanning.