import { cn } from "@/lib/utils";

interface CpkLoaderProps {
  /** Status line under the spinner, e.g. "Signing in…". */
  text?: string;
  /** Cover the whole viewport (login, logout, route protection). Turn off to place it inline. */
  fullscreen?: boolean;
  className?: string;
}

/**
 * CPK-branded loader: a 64px dual-ring spinner in CPK navy (--accent, #1E3A8A) and crimson (--danger, #DC2626)
 * with a "CPK" badge in the centre. Shared by sign-in, sign-out and route protection so they all look the same.
 */
export function CpkLoader({ text = "Loading…", fullscreen = true, className }: CpkLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-5 bg-canvas",
        fullscreen ? "fixed inset-0 z-[100]" : "min-h-64 w-full py-16",
        className,
      )}
    >
      <div className="relative h-16 w-16" aria-hidden="true">
        {/* Faint track so the arcs read as rings. */}
        <span className="absolute inset-0 rounded-full border-4 border-accent/10" />
        {/* Outer navy arc, clockwise. */}
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-accent border-r-accent motion-reduce:animate-[spin_3s_linear_infinite]" />
        {/* Inner crimson arc, counter-clockwise. */}
        <span className="absolute inset-2 animate-spin rounded-full border-4 border-transparent border-b-danger border-l-danger [animation-direction:reverse] [animation-duration:0.8s] motion-reduce:animate-[spin_3s_linear_infinite]" />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold tracking-wider text-accent">CPK</span>
      </div>
      <p className="text-sm font-semibold tracking-wide text-accent">{text}</p>
    </div>
  );
}
