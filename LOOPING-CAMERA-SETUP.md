# Looping CCTV Test Camera

This project includes a browser preview and an optional RTSP feed for testing your AI/ML detector with the same looping MP4.

## 1. Browser preview

The supplied test video is stored at `public/stream.mp4`. Open `/live-camera` in the app. If the Neon `cameras` table has no rows, the page displays a temporary `CAM-01` test camera using this MP4. The video is muted, loops continuously, and is released when its feed is unmounted/paused.

This fallback camera is only a UI test source; it is **not inserted into Neon** and it does not create fake detection records.

## 2. Publish an RTSP feed for the AI/ML process

The RTSP publisher uses FFmpeg and MediaMTX.

1. Install Docker Desktop and FFmpeg (make sure `ffmpeg` is available on PATH).
2. From the project root, start the RTSP server:

   ```bash
   docker compose -f docker-compose.camera.yml up -d
   ```

3. In a second terminal, publish the looping MP4:

   **Windows PowerShell**
   ```powershell
   .\scripts\start-loop-camera.ps1
   ```

   **Linux/macOS**
   ```bash
   chmod +x scripts/start-loop-camera.sh
   ./scripts/start-loop-camera.sh
   ```

4. Configure your Python/OpenCV/AI detector to read:

   ```text
   rtsp://127.0.0.1:8554/camera1
   ```

   If your detector runs inside another Docker container, `127.0.0.1` refers to that container itself; use `host.docker.internal:8554` (or the MediaMTX service name if both containers share a Docker network).

Keep the FFmpeg terminal running while testing. Stop it with `Ctrl+C`; stop MediaMTX with:

```bash
docker compose -f docker-compose.camera.yml down
```

## 3. Important notes

- `/live-camera` plays the MP4 directly in the browser. RTSP is a separate publisher for the AI/ML backend; a browser cannot directly play RTSP.
- The source MP4 loops from beginning to end indefinitely. This is a prerecorded test feed, not a physical camera or genuine live footage.
- Detection overlays and database events appear only when your actual detector sends detection results/events to the app's existing backend/Neon schema. This project ZIP does not include your Python inference service or its ingestion API, so the RTSP input is provided as the integration point rather than claiming that detections are already being generated.
- Do not expose the RTSP port publicly. Keep it on your development machine or a private network.
