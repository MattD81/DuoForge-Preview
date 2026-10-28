"""Private, localhost-only TripoSR image-to-3D adapter for DuoForge Character Forge.

This process does NOT run on GitHub Pages. The owner installs upstream MIT-licensed
TripoSR and model weights on a compatible machine (~6 GB VRAM is recommended).
No image is ever sent to DuoForge, OpenAI, or a commercial API by this adapter.
"""
from __future__ import annotations

import argparse
import io
import os
from pathlib import Path
import subprocess
import tempfile

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_GLB_BYTES = 50 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000

ALLOWED_ORIGINS = {
    "https://mattd81.github.io",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
}
RUNNER = Path(os.environ.get("TRIPOSR_RUNNER", "./TripoSR/run.py")).resolve()
PYTHON = os.environ.get("TRIPOSR_PYTHON", os.sys.executable)
app = FastAPI(title="DuoForge Image-to-3D (private/local)", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ALLOWED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["X-DuoForge-Request", "Content-Type"],
)


def validate_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image must be between 1 byte and 12 MB")
    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        image = Image.open(io.BytesIO(data))
        if image.width > 6000 or image.height > 6000:
            raise ValueError("Image dimensions exceed maximum 6000 px")
        return image.convert("RGBA")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("File is not a valid PNG, JPG, or WEBP") from exc


def authorized(request: Request, marker: str | None) -> None:
    # CORS alone does not reject simple cross-origin form submissions.
    # A custom required header forces a CORS preflight from browsers.
    if request.headers.get("origin") not in ALLOWED_ORIGINS or marker != "character-forge-v1":
        raise HTTPException(403, "Only the authorized local DuoForge client may submit.")


@app.get("/health")
def health(request: Request):
    if request.headers.get("origin") not in ALLOWED_ORIGINS:
        raise HTTPException(403, "Forbidden origin")
    return {"ready": RUNNER.is_file(), "engine": "TripoSR", "local_only": True}


@app.post("/generate")
async def generate(
    request: Request,
    image: UploadFile = File(...),
    x_duoforge_request: str | None = Header(default=None),
):
    authorized(request, x_duoforge_request)
    if not RUNNER.is_file():
        raise HTTPException(503, "TripoSR not installed; see service README.")
    if image.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Please use a PNG, JPG, or WEBP.")
    raw = await image.read(MAX_IMAGE_BYTES + 1)
    await image.close()
    try:
        picture = validate_image(raw)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    with tempfile.TemporaryDirectory(prefix="duoforge-triposr-") as temporary:
        work = Path(temporary)
        source = work / "input.png"
        output = work / "output"
        picture.save(source, format="PNG")
        # Fixed executable, file arguments and timeout, without shell execution.
        command = [
            PYTHON, str(RUNNER), str(source), "--output-dir", str(output),
            "--model-save-format", "glb", "--mc-resolution", "192",
        ]
        try:
            result = subprocess.run(command, cwd=RUNNER.parent, timeout=600,
                                    capture_output=True, text=True, check=False)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(504, "Local reconstruction timed out.") from exc
        if result.returncode != 0:
            # Do not leak paths, tokens, model cache content or process stdout.
            raise HTTPException(502, "Local TripoSR inference failed; check server logs.")
        mesh = output / "0" / "mesh.glb"
        if not mesh.is_file() or mesh.stat().st_size > MAX_GLB_BYTES:
            raise HTTPException(502, "TripoSR did not produce an acceptable GLB.")
        content = mesh.read_bytes()
        if content[:4] != b"glTF":
            raise HTTPException(502, "Invalid generated GLB.")
        return Response(content=content, media_type="model/gltf-binary",
                        headers={"Cache-Control": "no-store"})


if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser(description="Local-only image-to-3D service")
    parser.add_argument("--port", type=int, default=7863)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port)
