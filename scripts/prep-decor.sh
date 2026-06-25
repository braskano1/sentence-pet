#!/usr/bin/env bash
# Prep decor room backgrounds: resize to 1280w + webp. No bg removal (full-frame scenes).
#
# Source art (Google-Drive docs dir, NOT the build dir):
#   H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures/room
# These are 16:9 full-bleed scenes used as room backgrounds behind the pet — keep the
# whole frame (no floodfill/cutout, unlike prep-sprites.sh).
set -euo pipefail

SRC="H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures/room"
OUT="src/assets/sprites/decor"
mkdir -p "$OUT"

# slug => source filename (exact names)
declare -A ROOMS=(
  [beach]="ChatGPT Image Jun 24, 2026, 10_14_23 PM.png"
  [forest-path]="ChatGPT Image Jun 24, 2026, 10_14_20 PM.png"
  [night-room]="ChatGPT Image Jun 24, 2026, 10_14_17 PM.png"
  [forest-room]="ChatGPT Image Jun 24, 2026, 10_13_51 PM.png"
  [sky-room]="ChatGPT Image Jun 24, 2026, 10_14_00 PM.png"
  [fire-room]="ChatGPT Image Jun 24, 2026, 10_13_47 PM.png"
  [water-room]="ChatGPT Image Jun 24, 2026, 10_13_55 PM.png"
)

for slug in "${!ROOMS[@]}"; do
  src="$SRC/${ROOMS[$slug]}"
  magick "$src" -resize 1280x\> -quality 75 "$OUT/$slug.webp"
  echo "  $slug.webp  $(du -h "$OUT/$slug.webp" | cut -f1)"
done

echo "Done. QA montage:"
magick montage "$OUT"/*.webp -tile 4x2 -geometry 320x180+4+4 "$OUT/_montage-qa.png"
echo "  $OUT/_montage-qa.png"
