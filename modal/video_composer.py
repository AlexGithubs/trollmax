"""
TROLLMAX Video Composer — Modal FastAPI app

Accepts audio + background type + captions, renders a 9:16 MP4 with
burned-in captions using FFmpeg, and returns raw MP4 bytes.

D-ID talking-head (when talkingVideoUrl is set):
  - talkingMode full (default): D-ID padded to 886×1575 inside 1080×1920 canvas.
  - talkingMode half: top 960px D-ID, bottom 960px gameplay or solid color.

Backgrounds (half bottom, or legacy compose without D-ID):
  - asset:minecraft     => bundled gameplay clip in modal/assets/minecraft-source.mp4
  - asset:subway-surfers => bundled gameplay clip in modal/assets/subway-source.mp4
  - fallback to solid color if no supported background asset is provided.

Deploy:
  python3 -m modal deploy modal/video_composer.py

Then copy the deployed URL and set:
  MODAL_FFMPEG_URL=<url>
  MODAL_TOKEN_ID=<token_id>
  MODAL_TOKEN_SECRET=<token_secret>
"""

import asyncio
import base64
import os
import secrets
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional

import modal
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

app = modal.App("trollmax-video-composer")

image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "fonts-dejavu-core")
    .pip_install("fastapi", "pydantic", "httpx")
    .add_local_file(
        local_path=Path(__file__).parent / "assets" / "minecraft-source.mp4",
        remote_path="/root/assets/minecraft-source.mp4",
    )
    .add_local_file(
        local_path=Path(__file__).parent / "assets" / "subway-source.mp4",
        remote_path="/root/assets/subway-source.mp4",
    )
)

# Background color palette (FFmpeg hex format)
BG_COLORS: dict[str, str] = {
    "minecraft": "0x2d5a1b",
    "subway-surfers": "0xe8721a",
    "default": "0x111111",
}

web_app = FastAPI()


class Caption(BaseModel):
    startMs: int
    endMs: int
    text: str


class ComposeRequest(BaseModel):
    audioUrl: Optional[str] = None
    audioBase64: Optional[str] = None  # base64-encoded audio bytes (used when blob is private)
    backgroundAsset: Optional[str] = None
    backgroundType: Optional[str] = None
    talkingVideoUrl: Optional[str] = None
    talkingMode: Optional[str] = None
    captions: list[Caption]
    voiceVolumeMultiplier: Optional[float] = 1.0


def verify_basic_auth(request: Request) -> None:
    """Validate Basic auth against MODAL_TOKEN_ID:MODAL_TOKEN_SECRET."""
    token_id = os.environ.get("MODAL_TOKEN_ID", "")
    token_secret = os.environ.get("MODAL_TOKEN_SECRET", "")
    if not token_id or not token_secret:
        return  # Auth not configured — skip

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        decoded = base64.b64decode(auth_header[6:]).decode()
        provided_id, provided_secret = decoded.split(":", 1)
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not (
        secrets.compare_digest(provided_id, token_id)
        and secrets.compare_digest(provided_secret, token_secret)
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


@web_app.post("/compose")
async def compose_video(
    body: ComposeRequest,
    _: None = Depends(verify_basic_auth),
) -> Response:
    import httpx

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")
        talking_video_path: Optional[str] = None
        if body.talkingVideoUrl:
            talking_video_path = os.path.join(tmpdir, "talking.mp4")

        if not body.audioBase64 and not body.audioUrl:
            raise HTTPException(status_code=400, detail="Either audioUrl or audioBase64 must be provided")

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            async def fetch_audio() -> None:
                if body.audioBase64:
                    with open(audio_path, "wb") as f:
                        f.write(base64.b64decode(body.audioBase64))
                    return
                try:
                    r = await client.get(body.audioUrl, follow_redirects=True)
                    r.raise_for_status()
                except Exception as exc:
                    raise HTTPException(status_code=500, detail=f"Audio download failed: {exc}")
                with open(audio_path, "wb") as f:
                    f.write(r.content)

            async def fetch_talking() -> None:
                if not talking_video_path:
                    return
                try:
                    r2 = await client.get(body.talkingVideoUrl, follow_redirects=True)
                    r2.raise_for_status()
                except Exception as exc:
                    raise HTTPException(status_code=500, detail=f"Talking-video download failed: {exc}")
                with open(talking_video_path, "wb") as f:
                    f.write(r2.content)

            if talking_video_path:
                await asyncio.gather(fetch_audio(), fetch_talking())
            else:
                await fetch_audio()

        output_path = os.path.join(tmpdir, "output.mp4")
        vol = body.voiceVolumeMultiplier or 1.0
        caption_paths = _write_caption_text_files(tmpdir, body.captions)

        # "half" splits the frame (talking head top, gameplay bottom).
        # Everything else is full-frame talking head.
        is_half_layout = (body.talkingMode or "full").lower().strip() == "half"

        compose_mode: str

        if talking_video_path:
            if is_half_layout:
                # ── Half layout: talking head top half, background bottom half ──────
                bg_color = BG_COLORS.get(body.backgroundType or "", BG_COLORS["default"])
                background_clip = _resolve_background_clip(body.backgroundAsset)
                audio_fc = _build_audio_volume_filter(vol, audio_input_idx=2)

                if background_clip:
                    compose_mode = "talking-half-gameplay"
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-i", talking_video_path,
                        "-stream_loop", "-1", "-i", background_clip,
                        "-i", audio_path,
                        "-filter_complex",
                        _build_talking_half_filter(body.captions, caption_paths) + audio_fc[0],
                        "-map", "[v]", "-map", audio_fc[1],
                        "-c:v", "libx264", "-r", "24", "-preset", "fast", "-crf", "20",
                        "-c:a", "aac", "-b:a", "192k",
                        "-movflags", "+faststart", "-shortest", output_path,
                    ]
                else:
                    compose_mode = "talking-half-solid"
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-i", talking_video_path,
                        "-f", "lavfi", "-i", f"color=c={bg_color}:s=1080x960:r=30",
                        "-i", audio_path,
                        "-filter_complex",
                        _build_talking_half_filter(body.captions, caption_paths) + audio_fc[0],
                        "-map", "[v]", "-map", audio_fc[1],
                        "-c:v", "libx264", "-r", "24", "-preset", "fast", "-crf", "20",
                        "-c:a", "aac", "-b:a", "192k",
                        "-movflags", "+faststart", "-shortest", output_path,
                    ]
            else:
                # ── Full layout: talking head padded to 1080×1920 canvas ─────────
                compose_mode = "talking-full"
                audio_fc = _build_audio_volume_filter(vol, audio_input_idx=1)
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-i", talking_video_path,
                    "-i", audio_path,
                    "-filter_complex",
                    _build_talking_full_filter(body.captions, caption_paths) + audio_fc[0],
                    "-map", "[v]", "-map", audio_fc[1],
                    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                    "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", "-shortest", output_path,
                ]

        else:
            # ── No talking head: background gameplay or solid color ───────────────
            background_clip = _resolve_background_clip(body.backgroundAsset)
            audio_fc = _build_audio_volume_filter(vol, audio_input_idx=1)

            if background_clip:
                compose_mode = "background-gameplay"
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-stream_loop", "-1", "-i", background_clip,
                    "-i", audio_path,
                    "-filter_complex",
                    _build_background_filter(body.captions, caption_paths) + audio_fc[0],
                    "-map", "[v]", "-map", audio_fc[1],
                    "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                    "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", "-shortest", output_path,
                ]
            else:
                compose_mode = "solid-color"
                bg_color = BG_COLORS.get(body.backgroundType or "", BG_COLORS["default"])
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-f", "lavfi", "-i", f"color=c={bg_color}:s=1080x1920:r=30",
                    "-i", audio_path,
                    "-filter_complex",
                    _build_solid_color_filter(bg_color, body.captions, caption_paths) + audio_fc[0],
                    "-map", "[v]", "-map", audio_fc[1],
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", "-shortest", output_path,
                ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"FFmpeg failed: {result.stderr[-500:]}")

        with open(output_path, "rb") as f:
            mp4_bytes = f.read()

    return Response(
        content=mp4_bytes,
        media_type="video/mp4",
        headers={"X-Trollmax-Compose-Mode": compose_mode},
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_background_clip(background_asset: Optional[str]) -> Optional[str]:
    if background_asset == "asset:minecraft":
        return "/root/assets/minecraft-source.mp4"
    if background_asset == "asset:subway-surfers":
        return "/root/assets/subway-source.mp4"
    return None


# Caption styling constants
_CAPTION_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_CAPTION_FONTSIZE = 88
_CAPTION_BORDERW = 8


def _caption_display_text(text: str) -> str:
    return text.strip().lower()


def _write_caption_text_files(tmpdir: str, captions: list[Caption]) -> list[str]:
    """Write one UTF-8 file per caption so drawtext can use textfile= (avoids shell-escaping issues)."""
    paths: list[str] = []
    for i, cap in enumerate(captions):
        p = os.path.join(tmpdir, f"caption_{i}.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(_caption_display_text(cap.text))
        paths.append(p)
    return paths


def _drawtext(textfile_path: str, start_s: float, end_s: float, *, y_expr: str) -> str:
    """Single timed drawtext filter clause."""
    return (
        f"drawtext=fontfile={_CAPTION_FONT}"
        f":textfile={textfile_path}"
        f":fontsize={_CAPTION_FONTSIZE}"
        f":fontcolor=white"
        f":borderw={_CAPTION_BORDERW}"
        f":bordercolor=black"
        f":shadowcolor=black:shadowx=2:shadowy=2"
        f":x=(w-text_w)/2"
        f":y={y_expr}"
        f":enable='between(t,{start_s:.3f},{end_s:.3f})'"
    )


def _caption_drawtext_chain(
    captions: list[Caption], paths: list[str], *, y_expr: str
) -> str:
    """Comma-joined drawtext clauses for all captions."""
    return ",".join(
        _drawtext(path, cap.startMs / 1000.0, cap.endMs / 1000.0, y_expr=y_expr)
        for cap, path in zip(captions, paths)
    )


def _build_audio_volume_filter(vol: float, audio_input_idx: int) -> tuple[str, str]:
    """Return (filter_complex_suffix, map_ref) for audio volume control.

    When vol == 1.0 the stream is mapped directly (no filter needed).
    When vol != 1.0 a volume filter is injected into the filter_complex graph.
    """
    if abs(vol - 1.0) < 1e-6:
        return "", f"{audio_input_idx}:a"
    return f";[{audio_input_idx}:a]volume={vol:.6f}[outa]", "[outa]"


# ── Filter builders ───────────────────────────────────────────────────────────

def _build_talking_full_filter(captions: list[Caption], paths: list[str]) -> str:
    """Full-mode talking head: scale to fill 1080×1920, captions at bottom.

    HeyGen outputs a true 9:16 portrait at 1080p with no internal face-zoom,
    so we scale to fill the full canvas. The pad step is a no-op for a perfect
    9:16 source but harmlessly centres any slightly off-ratio input.
    """
    base = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[bg]"
    )
    if not captions:
        return f"{base};[bg]copy[v]"
    chain = _caption_drawtext_chain(captions, paths, y_expr="h-text_h-160")
    return f"{base};[bg]{chain}[v]"


def _build_talking_half_filter(captions: list[Caption], paths: list[str]) -> str:
    """Half-mode D-ID: talking head fills top 960px, background fills bottom 960px."""
    top = (
        "[0:v]fps=24,"
        "scale=886:788:force_original_aspect_ratio=decrease,"
        "pad=1080:960:(ow-iw)/2:(oh-ih)/2:black,setsar=1[top]"
    )
    bottom = (
        "[1:v]fps=24,scale=1080:960:force_original_aspect_ratio=increase,"
        "crop=1080:960,setsar=1[bottom]"
    )
    stacked = "[top][bottom]vstack=inputs=2[bg]"
    if not captions:
        return f"{top};{bottom};{stacked};[bg]copy[v]"
    chain = _caption_drawtext_chain(captions, paths, y_expr="(h-text_h)/2")
    return f"{top};{bottom};{stacked};[bg]{chain}[v]"


def _build_background_filter(captions: list[Caption], paths: list[str]) -> str:
    """Gameplay-only mode: fill-crop source to 1080×1920, captions centered."""
    base = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg]"
    if not captions:
        return f"{base};[bg]copy[v]"
    chain = _caption_drawtext_chain(captions, paths, y_expr="(h-text_h)/2")
    return f"{base};[bg]{chain}[v]"


def _build_solid_color_filter(
    bg_color: str, captions: list[Caption], paths: list[str]
) -> str:
    """Solid color background with captions centered."""
    if not captions:
        return f"color=c={bg_color}:s=1080x1920:r=30[v]"
    chain = _caption_drawtext_chain(captions, paths, y_expr="(h-text_h)/2")
    return f"color=c={bg_color}:s=1080x1920:r=30[bg];[bg]{chain}[v]"


@app.function(image=image, timeout=600)
@modal.asgi_app()
def fastapi_app() -> Any:
    return web_app
