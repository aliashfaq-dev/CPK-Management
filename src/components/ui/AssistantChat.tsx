"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { faArrowRight, faPaperPlane, faSpinner, faTrashCan, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Detection } from "@/types";
import { ConfidenceCell } from "@/components/detections/ConfidenceCell";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { askAssistant } from "@/lib/assistant";
import { getCameras, getDetections } from "@/lib/data-service";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "./Button";
import { Card } from "./Card";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  results?: Detection[];
  total?: number;
  href?: string;
}

interface AssistantChatProps {
  title?: string;
  description?: string;
  suggestions?: string[];
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  "White car near Clifton today",
  "Show me BKL-2847",
  "Kala motorcycle Saddar par",
  "Trucks in the last hour",
];

export function AssistantChat({
  title = "Ask the CPK assistant",
  description = "Describe what you are looking for in English or Roman Urdu: a plate, vehicle type, color, camera, or time.",
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  const send = async (raw: string) => {
    const query = raw.trim();
    if (!query || pending) return;
    setMessages((current) => [...current, { id: nextId.current++, role: "user", text: query }]);
    setInput("");
    setPending(true);
    try {
      const [detections, cameras] = await Promise.all([getDetections(), getCameras()]);
      const reply = await askAssistant(query, detections, cameras);
      setMessages((current) => [...current, { id: nextId.current++, role: "assistant", ...reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: "The search failed. Check your connection and send the question again." },
      ]);
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
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
          <Button variant="ghost" size="sm" icon={faTrashCan} onClick={() => setMessages([])}>
            Clear chat
          </Button>
        )}
      </div>

      <div ref={logRef} role="log" aria-live="polite" aria-label="Search conversation" className="max-h-[26rem] min-h-56 space-y-4 overflow-y-auto bg-subtle p-5">
        {messages.length === 0 && !pending && (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">What vehicle are you looking for?</p>
            <p className="mt-1 text-xs text-muted">Try one of these, or type your own question below.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">{message.text}</p>
            </div>
          ) : (
            <div key={message.id} className="max-w-[95%] space-y-3">
              <p className="inline-block rounded-lg rounded-bl-sm border border-line bg-surface px-4 py-2.5 text-sm">{message.text}</p>
              {message.results && message.results.length > 0 && (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {message.results.map((d) => (
                    <li key={d.id}>
                      <Link href={`/detections?q=${encodeURIComponent(d.plate)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                        <VehicleThumbnail type={d.vehicleType} />
                        <span className="min-w-0 flex-1">
                          <PlateTag plate={d.plate} />
                          <span className="mt-1 block truncate text-xs text-muted">
                            {d.color} {d.make} · {d.cameraName} · {formatDateTime(d.detectedAt)}
                          </span>
                        </span>
                        <ConfidenceCell value={d.confidence} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {message.href && (message.total ?? 0) > 0 && (
                <Link href={message.href} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                  Open all {message.total} in Detections
                  <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                </Link>
              )}
            </div>
          ),
        )}

        {pending && (
          <p role="status" className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted">
            <FontAwesomeIcon icon={faSpinner} spin />
            Searching detections…
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-line p-4">
        <div className="flex items-end gap-3 rounded-lg border border-line-strong bg-surface p-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <label htmlFor="assistant-input" className="sr-only">
            Describe the vehicle you are looking for
          </label>
          <textarea
            id="assistant-input"
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Plate number, gaari, colour ya camera likhein… jaise: white Corolla Clifton par aaj"
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted/70 focus:outline-none"
          />
          <Button type="submit" variant="danger" icon={faPaperPlane} disabled={!input.trim() || pending} aria-label="Send question">
            Search
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">Press Enter to search, Shift+Enter for a new line. This assistant searches the sample data only; it is not connected to an AI model yet.</p>
      </form>
    </Card>
  );
}
