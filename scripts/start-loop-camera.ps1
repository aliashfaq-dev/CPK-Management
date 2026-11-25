$ErrorActionPreference = "Stop"

$video = Join-Path $PSScriptRoot "..\\public\\stream.mp4"
$video = [System.IO.Path]::GetFullPath($video)

if (-not (Test-Path $video)) {
  throw "Missing video: $video"
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw "FFmpeg is not installed or not on PATH. Install FFmpeg, then reopen PowerShell."
}

Write-Host "Publishing the looping test video to rtsp://127.0.0.1:8554/camera1"
Write-Host "Keep this window open while your AI/ML detector is consuming the stream."

ffmpeg -hide_banner -loglevel info `
  -stream_loop -1 -re -i $video `
  -an -c:v libx264 -preset veryfast -tune zerolatency `
  -pix_fmt yuv420p -g 30 `
  -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/camera1
