"""Vendor pinned regional recordings as local MP3s for browsers and iPads.

Requires FFmpeg (on PATH or --ffmpeg) or imageio-ffmpeg. Cached originals and
both input/output hashes make replacement explicit.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "web/.cache/region-music"
OUTPUT = ROOT / "web/public/music"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def vendor(region, ffmpeg=None, refresh=False):
    tracks = json.loads((ROOT / f"web/src/features/music/{region}-tracks.json").read_text(encoding="utf-8"))
    for track in tracks:
        target = OUTPUT / track["file"]
        if not refresh and target.exists() and digest(target) == track["sha256"]:
            continue
        suffix = Path(urllib.parse.urlparse(track["source"]).path).suffix
        cached = CACHE / (track["sourceSha256"] + suffix)
        if not cached.exists():
            cached.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(track["source"], timeout=45) as response:
                cached.write_bytes(response.read())
        if digest(cached) != track["sourceSha256"]:
            raise ValueError(f"Source recording changed: {track['id']}")
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_suffix(".part.mp3")
        try:
            if not ffmpeg:
                import imageio_ffmpeg
                ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            subprocess.run([ffmpeg, "-nostdin", "-v", "error", "-y", "-i", str(cached),
                            "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", "128k",
                            "-ar", "44100", "-ac", "2", str(partial)], check=True)
            if digest(partial) != track["sha256"]:
                raise ValueError(f"Encoding differs for {track['id']}. The pinned output uses FFmpeg 9.0.2 / libmp3lame.")
            if not target.exists() or digest(target) != track["sha256"]:
                partial.replace(target)
        finally:
            partial.unlink(missing_ok=True)
    print(f"Verified {len(tracks)} local {region} music recordings.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("region", choices=["kanto", "hoenn", "johto"])
    parser.add_argument("--ffmpeg", help="Path to FFmpeg")
    parser.add_argument("--refresh", action="store_true", help="Re-encode every pinned original")
    args = parser.parse_args()
    ffmpeg = args.ffmpeg or shutil.which("ffmpeg")
    vendor(args.region, ffmpeg, args.refresh)
