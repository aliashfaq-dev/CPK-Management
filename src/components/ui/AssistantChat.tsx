"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  faArrowRight,
  faCircleExclamation,
  faDownload,
  faPaperPlane,
  faSpinner,
  faTrashCan,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { AppliedFilterChip, RawAiFilter } from "@/lib/ai-search-core";
import { askAssistant, type AssistantGroupRow } from "@/lib/assistant";
import type { Detection } from "@/types";
import { ConfidenceCell } from "@/components/detections/ConfidenceCell";
import { DetectionDetailDrawer } from "@/components/detections/DetectionDetailDrawer";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { cn, formatDateTime, formatNumber, vehicleDescription } from "@/lib/utils";
import { Button, buttonClasses } from "./Button";
import { Card } from "./Card";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  chips?: AppliedFilterChip[];
  groups?: AssistantGroupRow[];
  results?: Detection[];
  total?: number;
  href?: string;
  exportHref?: string;
  unavailable?: boolean;
}

interface AssistantChatProps {
  title?: string;
  description?: string;
  className?: string;
  /** Optional callback fired when a search yields URL filter query params (e.g. to sync page cards/table). */
  onSearchFilterHref?: (href: string) => void;
}

const MessageItem = memo(function MessageItem({
  message,
  onInspect,
}: {
  message: Message;
  onInspect: (detection: Detection) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[96%] space-y-3">
      {message.unavailable ? (
        <div
          role="alert"
          className="inline-flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-strong"
        >
          <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 shrink-0" />
          <span>{message.text}</span>
        </div>
      ) : (
        <p className="inline-block rounded-lg rounded-bl-sm border border-line bg-surface px-4 py-2.5 text-sm">
          {message.text}
        </p>
      )}

      {message.chips && message.chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Applied AI filters">
          <span className="text-[11px] font-medium text-muted">Applied filters:</span>
          {message.chips.map((chip, idx) => (
            <span
              key={`${chip.label}-${idx}`}
              className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-xs"
            >
              <span className="text-muted">{chip.label}:</span>
              <span className="font-medium text-fg">{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {message.groups && message.groups.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-subtle text-muted">
                <th scope="col" className="px-3.5 py-2 font-medium">Group</th>
                <th scope="col" className="px-3.5 py-2 text-right font-medium">Detections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {message.groups.map((group) => (
                <tr key={group.label}>
                  <td className="px-3.5 py-2 font-medium">{group.label}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{formatNumber(group.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message.results && message.results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {message.results.map((d, index) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onInspect(d)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle"
              >
                <VehicleThumbnail
                  type={d.vehicleType}
                  eventId={d.id}
                  hasImage={d.hasVehicleImage}
                  size={160}
                  priority={index < 4}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {d.hasPlateImage && (
                      <VehicleThumbnail
                        type={d.vehicleType}
                        eventId={d.id}
                        hasImage
                        kind="plate"
                        size={320}
                        priority={index < 4}
                        className="h-6 w-14"
                      />
                    )}
                    {d.plate ? (
                      <PlateTag plate={d.plate} />
                    ) : (
                      <span className="text-xs text-muted">No plate read</span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {VEHICLE_TYPE_LABELS[d.vehicleType]} · {vehicleDescription(d.color, d.make)} · {d.cameraName} · {formatDateTime(d.detectedAt)}
                  </span>
                </span>
                {d.hasPlate && <ConfidenceCell value={d.confidence} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(message.total ?? 0) > 0 && (message.href || message.exportHref) && (
        <div className="flex flex-wrap items-center gap-3">
          {message.href && (
            <Link
              href={message.href}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              Open all {formatNumber(message.total ?? 0)} in Detections
              <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </Link>
          )}
          {message.exportHref && (
            <a
              href={message.exportHref}
              className={cn(buttonClasses("secondary", "sm"), "h-7 px-2.5 text-xs")}
            >
              <FontAwesomeIcon icon={faDownload} />
              Export CSV
            </a>
          )}
        </div>
      )}
    </div>
  );
});

export function AssistantChat({
  title = "AI Search (Gemini)",
  description = "Ask in English or Roman Urdu — plates (exact or OCR-fuzzy), vehicle types, colours, cameras, counts, timelines, or follow-ups like “unmein se sirf white”.",
  className,
  onSearchFilterHref,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<RawAiFilter[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [inspected, setInspected] = useState<Detection | null>(null);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setHistory([]);
  }, []);

  const send = useCallback(async () => {
    const queryText = input.trim();
    if (!queryText || pending) return;

    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: queryText },
    ]);
    setInput("");
    setPending(true);

    try {
      const reply = await askAssistant(queryText, history);
      if (reply.appliedFilter) {
        const nextFilter = reply.appliedFilter;
        setHistory((current) => [...current.slice(-2), nextFilter]);
      }
      if (reply.href && onSearchFilterHref && !reply.unavailable) {
        onSearchFilterHref(reply.href);
      }
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", ...reply },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: error instanceof Error ? error.message : "AI search abhi available nahi.",
          unavailable: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }, [input, pending, history, onSearchFilterHref]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const canSend = input.trim().length > 0 && !pending;
  const showLog = messages.length > 0 || pending;

  return (
    <>
      <Card className={cn("overflow-hidden", className)}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-white">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-0.5 max-w-2xl text-xs text-muted">{description}</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" icon={faTrashCan} onClick={clearChat}>
              Clear chat
            </Button>
          )}
        </div>

        <form onSubmit={onSubmit} className="p-4 pt-3">
          <div className="rounded-lg border border-line-strong bg-surface p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <div className="flex items-center gap-2">
              <label htmlFor="assistant-input" className="sr-only">
                Ask Gemini AI to search vehicle detections
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder='e.g. "aaj safed car kitni aayin" or "timeline of plate HR26CQ6869"'
                className="max-h-40 min-h-10 flex-1 resize-none self-center overflow-y-auto border-0 bg-transparent px-2 py-2.5 text-sm leading-5 shadow-none outline-none placeholder:text-muted/70 focus:outline-none focus-visible:outline-none focus:ring-0"
              />
              <Button type="submit" variant="danger" icon={faPaperPlane} disabled={!canSend} aria-label="Run AI search">
                Search
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Enter to search, Shift+Enter for a new line. Follow-up questions remember your last 3 AI filter turns.
          </p>
        </form>

        {showLog && (
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="AI search conversation"
            className="max-h-[28rem] space-y-4 overflow-y-auto border-t border-line bg-subtle p-5"
          >
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} onInspect={setInspected} />
            ))}
            {pending && (
              <p
                role="status"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted"
              >
                <FontAwesomeIcon icon={faSpinner} spin />
                Running AI search…
              </p>
            )}
          </div>
        )}
      </Card>

      <DetectionDetailDrawer detection={inspected} onClose={() => setInspected(null)} />
    </>
  );
}
