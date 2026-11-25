# Show the looping MP4 inside the website camera frame

1. Keep `public/stream.mp4` in the project.
2. Open a terminal in this project folder and run `npm install` (only if dependencies are not installed).
3. Start the Next.js website with `npm run dev`.
4. Open `http://localhost:3000/live-camera`.

The first camera card now uses `/stream.mp4` as its browser preview, even when the Neon `cameras` table already contains camera rows. If the table is empty, the page uses the `CAM-01` test camera. The MP4 is muted and loops inside the camera frame.

The browser preview does not need the RTSP publisher. Keep the FFmpeg + MediaMTX processes running separately only when the Python AI/ML detector needs the RTSP input `rtsp://127.0.0.1:8554/camera1`.
