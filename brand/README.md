# Invoom brand

Everything needed to use the Invoom identity. The source of truth is the Figma brand guidelines; the files here are exports for code, docs and stores.

## Logo

The logo is the word **invoom** set in Poppins Bold, with the "v" replaced by the boomerang symbol (what you send out comes back). It is already vectorised: never retype it.

| File                                 | Use                                      |
| ------------------------------------ | ---------------------------------------- |
| `logo/invoom-logo-white.svg`, `.png` | Primary version, white on black          |
| `logo/invoom-logo-black.svg`, `.png` | On light backgrounds                     |
| `symbol/invoom-symbol-*.svg`, `.png` | The boomerang alone, when space is tight |

Keep clear space around the logo of at least the height of the "o". Don't recolour, stretch, rotate, outline or add effects to it.

## App icon

White symbol on a black tile (`#0A0A0B`), corner radius 22.36 %, symbol at 40 % of the tile height.

| File                                              | Use                                                          |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `icon/invoom-icon.svg`, `-1024/512/192.png`       | Rounded icon (web manifest, stores, docs)                    |
| `icon/invoom-icon-square.svg`, `-square-1024.png` | Full-bleed square, for platforms that apply their own mask   |
| `icon/invoom-icon-maskable-512.png`               | Android maskable icon                                        |
| `icon/apple-touch-icon.png`                       | iOS home screen (180 × 180, iOS rounds the corners)          |
| `icon/favicon.svg`, `favicon.ico`                 | Browser tab; the symbol is enlarged to stay legible at 16 px |

## Social

| File                                     | Use                                                      |
| ---------------------------------------- | -------------------------------------------------------- |
| `social/og-image.png`                    | Link previews (1200 × 630)                               |
| `social/github-social-preview.png`       | GitHub repository social preview (1280 × 640)            |
| `social/github-social-preview-light.png` | Light version of the cover (README in GitHub light mode) |

## Colours

The identity is black and white only, with no accent colour. Status colours are functional: they only mark payment and deadline states.

| Token       | Hex       | Name     | Use                          |
| ----------- | --------- | -------- | ---------------------------- |
| neutral-0   | `#FFFFFF` | Blanc    | Backgrounds, symbol on black |
| neutral-50  | `#FAFAFA` |          | Page background              |
| neutral-100 | `#F4F4F5` | Brume    | Light surfaces               |
| neutral-200 | `#E4E4E7` | Trait    | Borders, dividers            |
| neutral-300 | `#D4D4D8` |          |                              |
| neutral-400 | `#A1A1AA` |          | Secondary text on black      |
| neutral-500 | `#71717A` | Ardoise  | Secondary text               |
| neutral-600 | `#52525B` |          |                              |
| neutral-700 | `#3F3F46` |          |                              |
| neutral-800 | `#27272A` |          |                              |
| neutral-900 | `#18181B` | Graphite | Dark surfaces                |
| neutral-950 | `#0A0A0B` | Noir     | Brand black, logo, icon      |

| Status  | Background | Signal    | Text      |
| ------- | ---------- | --------- | --------- |
| Paid    | `#D1FAE5`  | `#059669` | `#047857` |
| Pending | `#FEF3C7`  | `#D97706` | `#B45309` |
| Late    | `#FEE2E2`  | `#DC2626` | `#B91C1C` |

The same values are available as CSS variables in `colors.css`.

## Typography

| Font                                                       | Use                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| [Poppins](https://fonts.google.com/specimen/Poppins) Bold  | Logo only (already vectorised), never for text           |
| [Geist](https://vercel.com/font) Regular, Medium, SemiBold | Interface, documents and invoices                        |
| [Geist Mono](https://vercel.com/font) Medium               | Amounts, invoice numbers, IBAN: aligned, readable digits |

Geist is under the SIL Open Font License; the TTF files used by the invoice PDF are in `apps/api/assets/fonts`.
