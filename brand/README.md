# Invoom brand

Everything needed to use the Invoom identity. The source of truth is the Figma brand guidelines; the files here are exports for code, docs and stores.

## Logo

The logo is the word **invoom** set in Poppins Bold, with the "v" replaced by the boomerang symbol (what you send out comes back). It is already vectorised: never retype it.

| File                                 | Use                                      |
| ------------------------------------ | ---------------------------------------- |
| `logo/invoom-logo-white.svg`, `.png` | Primary version, white on black          |
| `logo/invoom-logo-black.svg`, `.png` | On light backgrounds                     |
| `symbol/invoom-symbol-*.svg`, `.png` | The boomerang alone, when space is tight |

Keep clear space around the logo of at least the height of the "o". Use it in petrol (`#005461`), black or white only; don't stretch, rotate, outline or add effects to it.

## App icon

Petrol symbol (`#005461`, the app accent) on the app background (`#F4F4F4`), corner radius 22.36 %, symbol at 40 % of the tile height.

| File                                              | Use                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `icon/invoom-icon.svg`, `-1024/512/192.png`       | Rounded icon (web manifest, stores, docs)                           |
| `icon/invoom-icon-square.svg`, `-square-1024.png` | Full-bleed square, for platforms that apply their own mask          |
| `icon/invoom-icon-maskable-512.png`               | Android maskable icon                                               |
| `icon/apple-touch-icon.png`                       | iOS home screen (180 × 180, iOS rounds the corners)                 |
| `icon/favicon.svg`, `favicon.ico`                 | Browser tab: same colours, symbol enlarged to stay legible at 16 px |

## Social

| File                                                       | Use                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `social/og-image.png`                                      | Link previews (1200 × 630)                                  |
| `social/github-social-preview.png`                         | GitHub repository social preview (1280 × 640)               |
| `social/readme-banner-light.png`, `readme-banner-dark.png` | Transparent README banners for GitHub light and dark themes |

## Colours

A warm art direction: deep petrol as the accent, answered by terracotta, on warm neutrals. Status colours are functional: they only mark payment and deadline states.

| Token      | Hex       | Use                                            |
| ---------- | --------- | ---------------------------------------------- |
| background | `#F4F4F4` | Page background, app icon tile                 |
| card       | `#FAFAF8` | Cards and tables                               |
| field      | `#FFFEFC` | Form fields                                    |
| border     | `#E6E0D8` | Borders, dividers                              |
| muted text | `#6F665D` | Secondary text                                 |
| foreground | `#24201C` | Text                                           |
| primary    | `#005461` | Accent: logo, icon symbol, buttons, key values |
| highlight  | `#D0703C` | Second accent: charts, selection               |

| Status  | Colour    |
| ------- | --------- |
| Paid    | `#2E7D57` |
| Pending | `#B8741A` |
| Late    | `#B4432F` |

The interface tokens live in `apps/web/src/styles.css`; the same values are available as CSS variables in `colors.css`.

## Typography

| Font                                                       | Use                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| [Poppins](https://fonts.google.com/specimen/Poppins) Bold  | Logo only (already vectorised), never for text           |
| [Fraunces](https://fonts.google.com/specimen/Fraunces)     | Page titles and key figures in the app                   |
| [Geist](https://vercel.com/font) Regular, Medium, SemiBold | Interface, documents and invoices                        |
| [Geist Mono](https://vercel.com/font) Medium               | Amounts, invoice numbers, IBAN: aligned, readable digits |

Geist is under the SIL Open Font License; the TTF files used by the invoice PDF are in `apps/api/assets/fonts`.
