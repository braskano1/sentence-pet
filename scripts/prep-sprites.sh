#!/usr/bin/env bash
# Prep pet sprites: crop mood-sheet poses, cut cream bg, trim, resize, webp.
#
# Source art (Google-Drive docs dir, NOT the build dir):
#   H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures
#
# Every pet sprite comes from a 4-pose mood sheet (Animal/mood/*.png).
# Pose index (0-based) within each horizontal strip:
#   0 = content (eyes open)   1 = HAPPY (smiling)
#   2 = calm                  3 = SAD (eyes closed / sleepy)
# We extract pose 1 -> happy, pose 3 -> sad.
#
# Species <-> mood sheet (confirmed by inspection):
#   leaf : adult=10_12_57  young=10_13_14  baby=10_13_31
#   fire : adult=10_13_01  young=10_13_19  baby=10_13_36
#   air  : adult=10_13_05  young=10_13_24  baby=10_13_40
#   water: adult=10_13_09  young=10_13_27  baby=10_13_43
# Elemental eggs (Animal/ root, reserved for Phase B shop icons):
#   leaf=10_10_00  fire=10_10_13  air=10_10_06  water=10_09_54
# Generic pre-hatch egg: Animal/pets_egg.png.png
set -euo pipefail

SRC="H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures"
MOOD="$SRC/Animal/mood"
OUT="src/assets/sprites"
mkdir -p "$OUT"/{leaf,fire,air,water,eggs}

# cutout <input> <output> <fuzz%> [crop-geometry]
# Removes near-white/cream bg via floodfill from all four corners (NOT global
# -transparent white, which would eat the white owl), then trims + resizes + webp.
cutout() {
  local in="$1" out="$2" fuzz="${3:-12}" crop="${4:-}"
  local tmp; tmp="$(mktemp --suffix=.png)"
  if [ -n "$crop" ]; then magick "$in" -crop "$crop" +repage "$tmp"; else cp "$in" "$tmp"; fi
  magick "$tmp" -alpha set -bordercolor white -border 1 \
    -fuzz "${fuzz}%" \
    -fill none \
    -draw "alpha 0,0 floodfill" \
    -draw "alpha %[fx:w-1],0 floodfill" \
    -draw "alpha 0,%[fx:h-1] floodfill" \
    -draw "alpha %[fx:w-1],%[fx:h-1] floodfill" \
    -shave 1x1 -trim +repage \
    -resize x512 \
    -define webp:lossless=false -quality 80 "$out"
  rm -f "$tmp"
}

HAPPY="25%x100%+25%+0"   # pose 1
SAD="25%x100%+75%+0"     # pose 3

# species stage source-sheet  fuzz
emit() {
  local sp="$1" stage="$2" sheet="$3" fuzz="$4"
  cutout "$sheet" "$OUT/$sp/$stage-happy.webp" "$fuzz" "$HAPPY"
  cutout "$sheet" "$OUT/$sp/$stage-sad.webp"   "$fuzz" "$SAD"
}

# leaf
emit leaf  adult "$MOOD/ChatGPT Image Jun 24, 2026, 10_12_57 PM.png" 12
emit leaf  young "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_14 PM.png" 12
emit leaf  baby  "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_31 PM.png" 12
# fire
emit fire  adult "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_01 PM.png" 12
emit fire  young "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_19 PM.png" 12
emit fire  baby  "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_36 PM.png" 12
# air (white owl -> low fuzz so the white body survives)
emit air   adult "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_05 PM.png" 6
emit air   young "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_24 PM.png" 6
emit air   baby  "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_40 PM.png" 6
# water
emit water adult "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_09 PM.png" 12
emit water young "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_27 PM.png" 12
emit water baby  "$MOOD/ChatGPT Image Jun 24, 2026, 10_13_43 PM.png" 12

# generic pre-hatch egg
cutout "$SRC/Animal/pets_egg.png.png" "$OUT/egg.webp" 12

# elemental eggs (reserved for Phase B)
cutout "$SRC/Animal/ChatGPT Image Jun 24, 2026, 10_10_00 PM.png" "$OUT/eggs/leaf.webp"  12
cutout "$SRC/Animal/ChatGPT Image Jun 24, 2026, 10_10_13 PM.png" "$OUT/eggs/fire.webp"  12
cutout "$SRC/Animal/ChatGPT Image Jun 24, 2026, 10_10_06 PM.png" "$OUT/eggs/air.webp"   6
cutout "$SRC/Animal/ChatGPT Image Jun 24, 2026, 10_09_54 PM.png" "$OUT/eggs/water.webp" 12

echo "done -> $OUT"
