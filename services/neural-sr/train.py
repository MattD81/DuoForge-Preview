#!/usr/bin/env python3
"""DuoForge Neural SR: CPU-only reproducible training, with optional local atlas images.

Dependencies for *training only*: torch, numpy, Pillow.
python services/neural-sr/train.py --output workshop/studio/neural-sr-weights.mjs
python services/neural-sr/train.py --dataset-dir my-private-atlases --output workshop/studio/neural-sr-weights.mjs
No private training images are uploaded. No service or GPU is needed.
"""
import argparse
import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import torch
from torch import nn
from torch.nn import functional as F

WIDTH = 64
FEATURES = 8


class TinySR(nn.Module):
    """3x3 RGB→8 ReLU, 1x1 8→RGB residual on bilinear input."""
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, FEATURES, 3, padding=1)
        self.conv2 = nn.Conv2d(FEATURES, 3, 1)
        nn.init.kaiming_uniform_(self.conv1.weight, nonlinearity="relu")
        nn.init.zeros_(self.conv1.bias)
        nn.init.zeros_(self.conv2.weight)
        nn.init.zeros_(self.conv2.bias)

    def forward(self, x):
        return x + self.conv2(F.relu(self.conv1(x)))


def as_tensor(im):
    return torch.from_numpy(np.asarray(im.convert("RGB"), dtype=np.float32).copy()).permute(2, 0, 1) / 255.


def image(seed):
    r = random.Random(seed)
    side = WIDTH
    im = Image.new("RGB", (side, side), tuple(r.randrange(20, 225) for _ in range(3)))
    d = ImageDraw.Draw(im)
    for _ in range(r.randint(5, 16)):
        x, y = r.randint(-16, side), r.randint(-16, side)
        w, h = r.randint(4, 42), r.randint(4, 42)
        fill = tuple(r.randrange(0, 256) for _ in range(3))
        shape = r.randrange(4)
        if shape == 0:
            d.rectangle((x, y, x+w, y+h), fill=fill)
        elif shape == 1:
            d.ellipse((x, y, x+w, y+h), fill=fill)
        elif shape == 2:
            d.line((x, y, x+w, y+h), fill=fill, width=r.randint(1, 5))
        else:
            d.polygon(((x, y), (x+w, y+h//2), (x, y+h)), fill=fill)
    if seed % 3 == 0:
        im = im.filter(ImageFilter.GaussianBlur(0.6))
    return as_tensor(im)


def make_pair(high):
    x = high.unsqueeze(0)
    low = F.interpolate(x, scale_factor=.5, mode="area")
    up = F.interpolate(low, size=(WIDTH, WIDTH), mode="bilinear", align_corners=False)
    return up[0], high


def training_atlases(folder):
    """One PNG: left half is high-resolution reference; right half is nearest-upscaled low-res."""
    items = []
    for p in sorted(Path(folder).glob("*.png")):
        with Image.open(p) as image_file:
            im = image_file.convert("RGB")
            width, height = im.size
            if width % 2 or width < 64 or height < 32:
                raise ValueError(f"Invalid 2-panel training atlas: {p}")
            half = width // 2
            high = im.crop((0, 0, half, height)).resize((WIDTH, WIDTH), Image.Resampling.BILINEAR)
            low = im.crop((half, 0, width, height)).resize((WIDTH//2, WIDTH//2), Image.Resampling.NEAREST)
            x = F.interpolate(as_tensor(low)[None], size=(WIDTH, WIDTH), mode="bilinear", align_corners=False)[0]
            items.append((x, as_tensor(high)))
    if len(items) < 10:
        raise ValueError("At least 10 separate PNG atlas samples are required for train/validation split")
    return items


def psnr(y, x):
    return -10 * math.log10(max(float(F.mse_loss(y.clamp(0, 1), x)), 1e-12))


def train(steps=650, seed=20261029, dataset_dir=None):
    torch.manual_seed(seed)
    torch.set_num_threads(min(4, torch.get_num_threads()))
    if dataset_dir:
        images = training_atlases(dataset_dir)
        rng = random.Random(seed)
        rng.shuffle(images)
        count = max(2, len(images) // 5)
        dataset, heldout = images[:-count], images[-count:]
        kind = "local-duoforge-atlases"
    else:
        dataset = [make_pair(image(seed+i)) for i in range(120)]
        heldout = [make_pair(image(seed+10000+i)) for i in range(20)]
        kind = "deterministic-synthetic-v1"
    model = TinySR()
    optimizer = torch.optim.Adam(model.parameters(), lr=.003)
    rng = random.Random(seed)
    for _ in range(steps):
        pairs = [dataset[rng.randrange(len(dataset))] for _ in range(8)]
        low, target = (torch.stack([p[n] for p in pairs]) for n in range(2))
        loss = F.mse_loss(model(low), target)
        loss += .00001 * (model.conv1.weight.square().mean() + model.conv2.weight.square().mean())
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    with torch.no_grad():
        baseline = sum(psnr(low, high) for low, high in heldout) / len(heldout)
        result = sum(psnr(model(low.unsqueeze(0))[0], high) for low, high in heldout) / len(heldout)
        return {
            "version": "duoforge-neural-sr@0.1",
            "architecture": "rgb-3x3-8relu-1x1-rgb-residual",
            "features": FEATURES,
            "scale": 2,
            "training": {"kind": kind, "seed": seed, "steps": steps,
                         "validationImages": len(heldout),
                         "baselinePsnrDb": round(baseline, 3),
                         "modelPsnrDb": round(result, 3)},
            "conv1Weight": model.conv1.weight.detach().flatten().tolist(),
            "conv1Bias": model.conv1.bias.detach().tolist(),
            "conv2Weight": model.conv2.weight.detach().flatten().tolist(),
            "conv2Bias": model.conv2.bias.detach().tolist(),
        }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--steps", type=int, default=650)
    p.add_argument("--dataset-dir", type=Path, default=None)
    p.add_argument("--output", type=Path, default=Path("workshop/studio/neural-sr-weights.mjs"))
    args = p.parse_args()
    if not 1 <= args.steps <= 5000:
        p.error("steps must be 1..5000")
    result = train(args.steps, dataset_dir=args.dataset_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Round to minimize download size; runtime performs schema/finite checks.
    for key in ("conv1Weight", "conv1Bias", "conv2Weight", "conv2Bias"):
        result[key] = [round(x, 5) for x in result[key]]
    args.output.write_text(
        "// Trained locally with services/neural-sr/train.py; no inference API.\n"
        "export const NEURAL_SR_MODEL=Object.freeze("
        + json.dumps(result, separators=(",", ":")) + ");\n", encoding="utf-8")
    print(json.dumps(result["training"], indent=2))


if __name__ == "__main__":
    main()
