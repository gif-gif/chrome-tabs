## Chrome Web Store assets

Materials for publishing the extension on the Chrome Web Store. Nothing here is part of the extension package; `npm run build` ignores this folder.

| File | Contents |
| --- | --- |
| `listing.en.md` / `listing.zh-CN.md` / `listing.zh-TW.md` | Store name, summary, detailed description, category, languages |
| `privacy-practices.md` | Single purpose, per-permission justifications, remote code, data usage answers |
| `privacy-policy.md` / `privacy-policy.html` | Bilingual privacy policy, ready to host |
| `submission-checklist.md` | Manifest, permissions, packaging and manual steps before submitting |
| `images/icon-128.png` | Store icon 128×128, transparent background (RGBA) |
| `images/<locale>/screenshots/*.png` | Five 1280×800 screenshots per language (`en`, `zh-CN`, `zh-TW`) |
| `images/<locale>/promo-small-440x280.png` | Small promo tile |
| `images/<locale>/promo-marquee-1400x560.png` | Marquee promo tile (optional on the store) |
| `scripts/` | Scripts that regenerate and check the images |

### Regenerating the icons

`assets/chrome-tabs-icon-source.png` is the supplied icon artwork. `make-icons.sh` fits it into 96×96 centered on a transparent 128×128 canvas for both `public/icons/icon-128.png` and `images/icon-128.png`, and clears near-invisible downscaling residue around the 16/32/48 px icons. `verify-icons.sh` checks every icon's size, RGBA mode, fully transparent corners, and the 16 px padding of the 128 px icons. Both need ImageMagick 7 and run from the repo root:

```bash
store-assets/scripts/make-icons.sh
store-assets/scripts/verify-icons.sh
```

The icons must keep their alpha channel. Do not flatten them like the screenshots below.

### Regenerating the screenshots and promo tiles

The screenshots are taken from the real built popup. `capture.mjs` serves `dist/` locally, replaces `chrome.*` with a stub that returns demo tabs, and screenshots five scenes per language; `compose.mjs` places them into the 1280×800 and promo layouts.

```bash
npm run build
mkdir -p /path/to/tools && cd /path/to/tools && npm i playwright-core
cp <repo>/store-assets/scripts/*.mjs .   # run from here so playwright-core resolves
node capture.mjs <repo>/dist ./shots
node compose.mjs ./shots <repo>/assets/chrome-tabs-icon.svg <repo>/store-assets/images
```

Set `LOCALES=zh-TW` (comma-separated) on both commands to regenerate only some languages. Set `CHROME_PATH` if Google Chrome is not at the default macOS location. `playwright-core` is intentionally not a project dependency. The composed screenshots and promo tiles (not the icon) are flattened to 24-bit RGB (no alpha), as the store requires; re-run that step after regenerating, e.g. with Pillow: `Image.open(p).convert('RGB').save(p)`.
