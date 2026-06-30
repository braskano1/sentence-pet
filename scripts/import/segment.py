# scripts/import/segment.py — one sheet -> {adult,young,baby}.webp + banner.png
# Usage: python segment.py <src.png> <out_sprite_dir> <out_banner.png>
# Prints JSON: {"blobCount": N, "bannerBox": [x,y,w,h] | null}
import sys, json
import numpy as np
from PIL import Image
from rembg import remove
import cv2

MAX = 512  # mirrors MAX_SPRITE_DIM in src/firebase/imageTranscode.ts

def main(src, out_dir, banner_path):
    img = Image.open(src).convert("RGBA")
    cut = remove(img)                      # rembg -> transparent bg (harmless CUDA warn on CPU)
    arr = np.array(cut)
    alpha = arr[:, :, 3]
    H = alpha.shape[0]
    mask = (alpha > 16).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    # component 0 = background; gather the rest with geometry
    comps = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 500:                     # drop specks
            continue
        comps.append({"i": i, "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                      "bot": int(y + h), "area": int(area)})
    if not comps:
        print(json.dumps({"blobCount": 0, "bannerBox": None})); return
    maxbot = max(c["bot"] for c in comps)
    ground = [c for c in comps if c["bot"] >= maxbot - 0.12 * H]   # share the baseline
    banner = [c for c in comps if c not in ground]
    ground.sort(key=lambda c: c["area"], reverse=True)
    three = ground[:3]
    three.sort(key=lambda c: c["x"])       # left->right = adult, young, baby
    names = ["adult", "young", "baby"]
    import os; os.makedirs(out_dir, exist_ok=True)
    for name, c in zip(names, three):
        comp_mask = (labels == c["i"]).astype(np.uint8)
        ys, xs = np.where(comp_mask)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = arr[y0:y1, x0:x1].copy()
        cm = comp_mask[y0:y1, x0:x1]
        crop[:, :, 3] = crop[:, :, 3] * cm  # isolate this component's alpha
        im = Image.fromarray(crop, "RGBA")
        w, h = im.size
        if max(w, h) > MAX:
            s = MAX / max(w, h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        im.save(os.path.join(out_dir, f"{name}.webp"), "WEBP", lossless=True)
    box = None
    if banner:
        b = max(banner, key=lambda c: c["area"])
        bx0, by0, bx1, by1 = b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]
        Image.fromarray(arr[by0:by1, bx0:bx1], "RGBA").save(banner_path)
        box = [b["x"], b["y"], b["w"], b["h"]]
    print(json.dumps({"blobCount": len(ground), "bannerBox": box}))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
