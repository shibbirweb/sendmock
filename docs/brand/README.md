# SendMock brand

| File | Use |
|------|-----|
| `sendmock-mark.svg` | The logo on its own: app sidebar, website nav, README headers. Transparent background. |
| `sendmock-tile.svg` | The logo in white on a rounded tile: favicons, app icons, social images. |

The mark is an envelope between code brackets: a developer tool for messages.

## Colours

A teal to emerald gradient, top left to bottom right.

| Theme | From (teal) | To (emerald) |
|-------|-------------|--------------|
| Light | `#0D9488` | `#10B981` |
| Dark | `#2DD4BF` | `#34D399` |

In code, use the `--brand-from` and `--brand-to` CSS variables (`web/src/index.css`, `website/app/global.css`) and the `SendMockLogo` component instead of copying the SVG.

## Rules

- Keep the mark at 16px or larger; use the tile below 24px on busy backgrounds.
- Do not recolour, rotate, stretch or add effects to the mark.
