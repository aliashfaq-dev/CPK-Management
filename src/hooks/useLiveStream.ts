import { useEffect, useState, type RefObject } from "react";

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * Attaches `src` to a <video> only while `active` is true and the browser tab is visible.
 * On deactivation or unmount it pauses, drops the source, and calls load() so the network
 * connection and decoder are released instead of running in the background.
 * Only progressive sources (mp4/webm) are handled; attach HLS/WebRTC here when a real stream exists.
 */
export function useLiveStream(ref: RefObject<HTMLVideoElement | null>, src: string | undefined, active: boolean): void {
  const visible = usePageVisible();
  const running = active && visible;

  useEffect(() => {
    const video = ref.current;
    if (!video || !src || !running) return;
    video.src = src;
    video.play().catch(() => {
      /* autoplay can be blocked; the stream stays paused until the user interacts */
    });
    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [ref, src, running]);
}
