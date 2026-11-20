#!/usr/bin/env bash
# Checks every extension and store icon: size, RGBA mode, transparent corners,
# and for 128px icons that the artwork fits a centered 96x96 box.
# Usage: store-assets/scripts/verify-icons.sh   (from the repo root; needs ImageMagick 7)
set -uo pipefail

fail=0
check() {
  local file=$1 size=$2
  local dims channels corners bbox
  dims=$(magick identify -format '%wx%h' "$file")
  channels=$(magick identify -format '%[channels]' "$file")
  corners=$(magick "$file" -format '%[fx:p{0,0}.a] %[fx:p{w-1,0}.a] %[fx:p{0,h-1}.a] %[fx:p{w-1,h-1}.a]' info:)
  bbox=$(magick "$file" -alpha extract -threshold 0 -format '%@' info:)
  local problems=()
  [[ $dims == "${size}x${size}" ]] || problems+=("size $dims, want ${size}x${size}")
  [[ $channels == srgba* ]] || problems+=("mode $channels, want RGBA")
  [[ $corners == "0 0 0 0" ]] || problems+=("corner alpha $corners, want 0")
  if [[ $size == 128 ]]; then
    # %@ is WxH+X+Y of the non-transparent area.
    local w h x y
    IFS='x+' read -r w h x y <<<"$bbox"
    (( w <= 96 && h <= 96 && x >= 16 && y >= 16 && x + w <= 112 && y + h <= 112 )) \
      || problems+=("artwork $bbox, want within 96x96+16+16")
  fi
  if (( ${#problems[@]} )); then
    fail=1
    printf 'FAIL %s: %s\n' "$file" "$(IFS=';'; echo "${problems[*]}")"
  else
    printf 'ok   %s  %s %s artwork=%s\n' "$file" "$dims" "$channels" "$bbox"
  fi
}

for size in 16 32 48 128; do
  check "public/icons/icon-$size.png" "$size"
done
check store-assets/images/icon-128.png 128

exit $fail
