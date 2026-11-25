#!/usr/bin/env bash
set -euo pipefail

VIDEO="$(cd "$(dirname "$0")/.." && pwd)/public/stream.mp4"
if [[ ! -f "$VIDEO" ]]; then
  echo "Missing video: $VIDEO" >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "FFmpeg is not installed or not on PATH." >&2
  exit 1
fi

echo "Publishing looping test video to rtsp://127.0.0.1:8554/camera1"
echo "Keep this process running while your AI/ML detector consumes the stream."
ffmpeg -hide_banner -loglevel info \
  -stream_loop -1 -re -i "$VIDEO" \
  -an -c:v libx264 -preset veryfast -tune zerolatency \
  -pix_fmt yuv420p -g 30 \
  -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/camera1
