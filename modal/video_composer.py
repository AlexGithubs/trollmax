"""
TROLLMAX Video Composer — Modal FastAPI app

Accepts audio + background type + captions, renders a 9:16 MP4 with
burned-in captions using FFmpeg, and returns raw MP4 bytes.

D-ID talking-head (when talkingVideoUrl is set):
  - talkingMode full (default): D-ID scaled to 1080x1920 + timed captions + TTS (no gameplay asset).
  - talkingMode half: top 960px D-ID, bottom 960px gameplay or solid color + captions + TTS.

Backgrounds (half bottom, or legacy compose without D-ID):
  - asset:minecraft => bundled gameplay clip in modal/assets/minecraft-source.mp4
  - asset:subway-surfers => bundled gameplay clip in modal/assets/subway-source.mp4
  - fallback to solid color only if no supported background asset is provided.

Deploy:
  modal deploy modal/video_composer.py

Then copy the deployed URL and set:
  MODAL_FFMPEG_URL=<url>
  MODAL_TOKEN_ID=<token_id>
  MODAL_TOKEN_SECRET=<token_secret>
"""

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
    audioUrl: str
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
        # Download audio
        audio_path = os.path.join(tmpdir, "audio.mp3")
        talking_video_path: Optional[str] = None
        if body.talkingVideoUrl:
            talking_video_path = os.path.join(tmpdir, "talking.mp4")

        # Use a long timeout — D-ID talking-head MP4s can be 10-50 MB and take >30s on Modal cold start.
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
            try:
                r = await client.get(body.audioUrl, follow_redirects=True)
                r.raise_for_status()
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Audio download failed: {exc}")
            with open(audio_path, "wb") as f:
                f.write(r.content)

            if talking_video_path:
                try:
                    r2 = await client.get(body.talkingVideoUrl, follow_redirects=True)
                    r2.raise_for_status()
                except Exception as exc:
                    raise HTTPException(status_code=500, detail=f"Talking-video download failed: {exc}")
                with open(talking_video_path, "wb") as f:
                    f.write(r2.content)

        output_path = os.path.join(tmpdir, "output.mp4")

        vol = body.voiceVolumeMultiplier or 1.0
        caption_paths = _write_caption_text_files(tmpdir, body.captions)

        # Only "half" splits the frame (talking head top, gameplay bottom). Anything else is full-frame talking head.
        is_half_layout = (body.talkingMode or "full").lower().strip() == "half"

        # Full-page talking head: only D-ID + TTS + captions — never load gameplay assets.
        # Half-page: need bottom-half source (gameplay clip or solid color fallback).
        # Legacy (no D-ID): background gameplay or solid color + TTS + captions.
        if talking_video_path:
            background_clip = (
                _resolve_background_clip(body.backgroundAsset) if is_half_layout else None
            )
        else:
            background_clip = _resolve_background_clip(body.backgroundAsset)

        # Returned to Next.js so we can detect stale Modal deployments that ignore talkingVideoUrl.
        compose_mode: str

        # If we have a D-ID talking-head MP4, it becomes the main visual.
        if talking_video_path:
            if is_half_layout:
                bg_color = BG_COLORS.get(body.backgroundType or "", BG_COLORS["default"])

                # Audio input index is 2 (0=talking, 1=background, 2=audio).
                _half_audio_fc = _build_half_audio_volume(vol, audio_input_idx=2)
                if background_clip:
                    compose_mode = "talking-half-gameplay"
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-i", talking_video_path,
                        "-stream_loop", "-1", "-i", background_clip,
                        "-i", audio_path,
                        "-filter_complex",
                        _build_talking_half_filter_complex(body.captions, caption_paths)
                        + _half_audio_fc[0],
                        "-map", "[v]",
                        "-map", _half_audio_fc[1],
                        "-c:v", "libx264",
                        "-r", "24",
                        "-preset", "veryfast",
                        "-crf", "25",
                        "-c:a", "aac",
                        "-b:a", "128k",
                        "-movflags", "+faststart",
                        "-shortest",
                        output_path,
                    ]
                else:
                    compose_mode = "talking-half-solid"
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-i", talking_video_path,
                        "-f", "lavfi", "-i", f"color=c={bg_color}:s=1080x960:r=30",
                        "-i", audio_path,
                        "-filter_complex",
                        _build_talking_half_filter_complex(body.captions, caption_paths)
                        + _half_audio_fc[0],
                        "-map", "[v]",
                        "-map", _half_audio_fc[1],
                        "-c:v", "libx264",
                        "-r", "24",
                        "-preset", "veryfast",
                        "-crf", "25",
                        "-c:a", "aac",
                        "-b:a", "128k",
                        "-movflags", "+faststart",
                        "-shortest",
                        output_path,
                    ]
            else:
                compose_mode = "talking-full"
                # Audio input index is 1 (0=talking video, 1=audio).
                _full_audio_fc = _build_half_audio_volume(vol, audio_input_idx=1)
                # Full-screen: talking head takes over the full frame.
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
                    "-i", talking_video_path,
                    "-i", audio_path,
                    "-filter_complex",
                    _build_video_filter_complex(
                        body.captions, caption_paths, fit_contain=True, captions_bottom=True
                    ) + _full_audio_fc[0],
                    "-map", "[v]",
                    "-map", _full_audio_fc[1],
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "23",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-movflags", "+faststart",
                    "-shortest",
                    output_path,
                ]

        elif background_clip:
            compose_mode = "background-gameplay"
            _bg_audio_fc = _build_half_audio_volume(vol, audio_input_idx=1)
            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-stream_loop", "-1", "-i", background_clip,
                "-i", audio_path,
                "-filter_complex",
                _build_video_filter_complex(body.captions, caption_paths, fit_contain=False)
                + _bg_audio_fc[0],
                "-map", "[v]",
                "-map", _bg_audio_fc[1],
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                "-shortest",
                output_path,
            ]
        else:
            compose_mode = "solid-color"
            bg_color = BG_COLORS.get(body.backgroundType or "", BG_COLORS["default"])
            _solid_audio_fc = _build_half_audio_volume(vol, audio_input_idx=1)
            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", f"color=c={bg_color}:s=1080x1920:r=30",
                "-i", audio_path,
                "-filter_complex",
                _build_color_filter_complex(bg_color, body.captions, caption_paths)
                + _solid_audio_fc[0],
                "-map", "[v]",
                "-map", _solid_audio_fc[1],
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "28",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                "-shortest",
                output_path,
            ]

        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg failed: {result.stderr[-500:]}"
            )

        with open(output_path, "rb") as f:
            mp4_bytes = f.read()

    return Response(
        content=mp4_bytes,
        media_type="video/mp4",
        headers={"X-Trollmax-Compose-Mode": compose_mode},
    )


def _resolve_background_clip(background_asset: Optional[str]) -> Optional[str]:
    if not background_asset:
        return None

    if background_asset == "asset:minecraft":
        return "/root/assets/minecraft-source.mp4"
    if background_asset == "asset:subway-surfers":
        return "/root/assets/subway-source.mp4"

    return None


# TikTok-style Reddit story captions: bold sans, white fill, heavy black outline, centered.
_CAPTION_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_CAPTION_FONTSIZE = 78
_CAPTION_BORDERW = 10


def _caption_display_text(text: str) -> str:
    return text.strip().lower()


def _write_caption_text_files(
    tmpdir: str, captions: list[Caption]
) -> list[str]:
    """Write one UTF-8 file per caption so drawtext can use textfile= (avoids filter escaping for quotes, etc.)."""
    paths: list[str] = []
    for i, cap in enumerate(captions):
        p = os.path.join(tmpdir, f"caption_{i}.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(_caption_display_text(cap.text))
        paths.append(p)
    return paths


def _drawtext_caption(
    textfile_path: str, start_s: float, end_s: float, *, y_expr: str = "(h-text_h)/2"
) -> str:
    # Paths from tempfile are safe for filter syntax; no spaces/colons on Linux tmp.
    return (
        f"drawtext=fontfile={_CAPTION_FONT}"
        f":textfile={textfile_path}"
        f":fontsize={_CAPTION_FONTSIZE}"
        f":fontcolor=white"
        f":borderw={_CAPTION_BORDERW}"
        f":bordercolor=black"
        f":x=(w-text_w)/2"
        f":y={y_expr}"
        # Quote the whole expr so commas are not treated as filter-chain separators.
        f":enable='between(t,{start_s:.3f},{end_s:.3f})'"
    )


def _build_color_filter_complex(
    bg_color: str, captions: list[Caption], caption_paths: list[str]
) -> str:
    """Build FFmpeg filter_complex string with drawtext overlays."""
    if not captions:
        return f"color=c={bg_color}:s=1080x1920:r=30[v]"

    drawtext_parts = []
    for cap, path in zip(captions, caption_paths):
        start_s = cap.startMs / 1000.0
        end_s = cap.endMs / 1000.0
        drawtext_parts.append(_drawtext_caption(path, start_s, end_s))

    filters = ",".join(drawtext_parts)
    return f"color=c={bg_color}:s=1080x1920:r=30[bg];[bg]{filters}[v]"


def _build_half_audio_volume(vol: float, audio_input_idx: int) -> tuple[str, str]:
    """Return (filter_complex_suffix, map_ref) for audio in a filter_complex context.

    When vol != 1.0 the audio is routed through a volume filter inside the
    filter_complex graph. When vol == 1.0 the audio stream is mapped directly.

    Returns a tuple of:
      - str: the filter_complex suffix to append (leading semicolon included, or empty)
      - str: the -map argument to use for the audio output stream
    """
    if abs(vol - 1.0) < 1e-6:
        return "", f"{audio_input_idx}:a"
    return f";[{audio_input_idx}:a]volume={vol:.6f}[outa]", "[outa]"


def _build_talking_half_filter_complex(
    captions: list[Caption], caption_paths: list[str]
) -> str:
    """Stack D-ID talking head (top) over background (bottom), then burn captions.
    Top: fit + pad (preserve D-ID framing). Bottom: cover + crop (gameplay fills half)."""
    top = (
        "[0:v]fps=24,scale=1080:960:force_original_aspect_ratio=decrease,"
        "pad=1080:960:(ow-iw)/2:(oh-ih)/2:black,setsar=1[top]"
    )
    bottom = (
        "[1:v]fps=24,scale=1080:960:force_original_aspect_ratio=increase,"
        "crop=1080:960,setsar=1[bottom]"
    )
    stacked = "[top][bottom]vstack=inputs=2[bg]"

    if not captions:
        return f"{top};{bottom};{stacked};[bg]copy[v]"

    parts: list[str] = []
    for cap, path in zip(captions, caption_paths):
        start_s = cap.startMs / 1000.0
        end_s = cap.endMs / 1000.0
        parts.append(_drawtext_caption(path, start_s, end_s))

    return f"{top};{bottom};{stacked};[bg]{','.join(parts)}[v]"


def _build_video_filter_complex(
    captions: list[Caption],
    caption_paths: list[str],
    *,
    fit_contain: bool = False,
    captions_bottom: bool = False,
) -> str:
    """Scale source video to 1080x1920 and draw timed captions.
    fit_contain: scale to fit inside the frame and pad with black (no extra crop zoom). Use for D-ID.
    Default: cover + center-crop (legacy gameplay full-screen)."""
    if fit_contain:
        base = (
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[bg]"
        )
    else:
        base = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg]"
    if not captions:
        return f"{base};[bg]copy[v]"

    parts: list[str] = []
    y_expr = "h-text_h-120" if captions_bottom else "(h-text_h)/2"
    for cap, path in zip(captions, caption_paths):
        start_s = cap.startMs / 1000.0
        end_s = cap.endMs / 1000.0
        parts.append(_drawtext_caption(path, start_s, end_s, y_expr=y_expr))
    return f"{base};[bg]{','.join(parts)}[v]"


@app.function(image=image, timeout=600)
@modal.asgi_app()
def fastapi_app() -> Any:
    return web_app
