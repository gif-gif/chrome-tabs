#!/usr/bin/env bash
# Builds the 128px extension icon and the store icon from the supplied artwork.
# Usage: store-assets/scripts/make-icons.sh   (from the repo root; needs ImageMagick 7)
#
# The 128px artwork is trimmed to its visible pixels, fitted into 96x96 and
# centered on a transparent 128x128 canvas, per the Chrome Web Store icon
# guidelines. The 16/32/48px icons keep their artwork; only the near-invisible
# downscaling residue (alpha <= 8/255) around them is cleared to fully
# transparent. Outputs keep their alpha channel; do not flatten them like the
# screenshots.
set -euo pipefail

src=assets/chrome-tabs-icon-source.png
outs=(public/icons/icon-128.png store-assets/images/icon-128.png)

for out in "${outs[@]}"; do
  magick "$src" -trim +repage \
    -filter Lanczos -resize 96x96 \
    -background none -gravity center -extent 128x128 \
    -strip -define png:color-type=6 "PNG32:$out"
  echo "wrote $out"
done

for size in 16 32 48; do
  out=public/icons/icon-$size.png
  magick "$out" -channel A -fx 'u<=8/255?0:u' +channel \
    -strip -define png:color-type=6 "PNG32:$out"
  echo "cleaned $out"
done
