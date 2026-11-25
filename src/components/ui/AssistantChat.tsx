"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  faArrowRight,
  faPaperclip,
  faPaperPlane,
  faSpinner,
  faTrashCan,
  faWandMagicSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera, Detection } from "@/types";
import { ConfidenceCell } from "@/components/detections/ConfidenceCell";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { askAssistant } from "@/lib/assistant";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "./Button";
import { Card } from "./Card";

interface Attachment {
  id: number;
  name: string;
  kind: "image" | "video";
  url: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  attachments?: Attachment[];
  results?: Detection[];
  total?: number;
  href?: string;
}

interface AssistantChatProps {
  detections: Detection[];
  cameras: Camera[];
  title?: string;
  description?: string;
  className?: string;
}

const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

function describeAttachments(items: Attachment[]): string {
  const images = items.filter((item) => item.kind === "image").length;
  const videos = items.length - images;
  const parts = [
    images > 0 && `${images} picture${images === 1 ? "" : "s"}`,
    videos > 0 && `${videos} video${videos === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return parts.join(" and ");
}

function AttachmentPreview({ item, onRemove }: { item: Attachment; onRemove: (id: number) => void }) {
  return (
    <li className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-subtle">
      {item.kind === "image" ? (
        // Blob URL from the file picker; next/image cannot optimise it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <video src={item.url} aria-label={item.name} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.name}`}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-fg/70 text-[10px] text-white hover:bg-fg"
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </li>
  );
}

const MessageItem = memo(function MessageItem({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2">
        {message.attachments && message.attachments.length > 0 && (
          <ul className="flex max-w-[85%] flex-wrap justify-end gap-2" aria-label="Attached files">
            {message.attachments.map((item) => (
              <li key={item.id} className="h-24 w-32 overflow-hidden rounded-md border border-line bg-surface">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <video src={item.url} aria-label={item.name} controls playsInline preload="metadata" className="h-full w-full object-cover" />
                )}
              </li>
            ))}
          </ul>
        )}
        {message.text && <p className="max-w-[85%] rounded-lg rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">{message.text}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-[95%] space-y-3">
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
  );
});

export function AssistantChat({
  title = "Ask the CPK assistant",
  description = "Describe what you are looking for in English or Roman Urdu: a plate, vehicle type, color, camera, or time. You can also attach pictures or videos.",
  className,
  detections,
  cameras,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());

  // Release every object URL still held when the chat unmounts.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // One-line box by default (placeholder vertically centred); grows with the text up to max-h-40.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending]);

  const revoke = useCallback((items: Attachment[]) => {
    for (const item of items) {
      URL.revokeObjectURL(item.url);
      urlsRef.current.delete(item.url);
    }
  }, []);

  const onFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;

      const accepted: Attachment[] = [];
      let problem: string | null = null;
      for (const file of files) {
        const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
        if (!kind) {
          problem = "Only pictures and videos can be attached.";
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          problem = `${file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
          continue;
        }
        if (draft.length + accepted.length >= MAX_ATTACHMENTS) {
          problem = `You can attach up to ${MAX_ATTACHMENTS} files per message.`;
          break;
        }
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        accepted.push({ id: nextId.current++, name: file.name, kind, url });
      }
      setAttachError(problem);
      if (accepted.length > 0) setDraft((current) => [...current, ...accepted]);
    },
    [draft.length],
  );

  const removeDraft = useCallback(
    (id: number) => {
      const target = draft.find((item) => item.id === id);
      if (target) revoke([target]);
      setDraft((current) => current.filter((item) => item.id !== id));
      setAttachError(null);
    },
    [draft, revoke],
  );

  const clearChat = useCallback(() => {
    revoke(messages.flatMap((message) => message.attachments ?? []));
    setMessages([]);
  }, [messages, revoke]);

  const send = useCallback(async () => {
    const query = input.trim();
    if ((!query && draft.length === 0) || pending) return;

    const attachments = draft;
    setMessages((current) => [...current, { id: nextId.current++, role: "user", text: query, attachments }]);
    setInput("");
    setDraft([]);
    setAttachError(null);
    setPending(true);

    const mediaNote =
      attachments.length > 0
        ? `Your ${describeAttachments(attachments)} ${attachments.length === 1 ? "is" : "are"} attached, but picture and video recognition is not connected yet, so only your text was searched.`
        : "";

    try {
      if (!query) {
        setMessages((current) => [
          ...current,
          {
            id: nextId.current++,
            role: "assistant",
            text: `${mediaNote} Add a plate number, vehicle type, color, camera, or time to search the database records.`,
          },
        ]);
        return;
      }
      const reply = await askAssistant(query, detections, cameras);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", ...reply, text: mediaNote ? `${reply.text} ${mediaNote}` : reply.text },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: "The search failed. Check your connection and send the question again." },
      ]);
    } finally {
      setPending(false);
    }
  }, [input, draft, pending]);

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

  const canSend = (input.trim().length > 0 || draft.length > 0) && !pending;
  const showLog = messages.length > 0 || pending;

  return (
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
          {draft.length > 0 && (
            <ul className="mb-2 flex gap-2 overflow-x-auto px-1 pt-1" aria-label="Files to send">
              {draft.map((item) => (
                <AttachmentPreview key={item.id} item={item} onRemove={removeDraft} />
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} tabIndex={-1} aria-hidden="true" />
            <Button
              variant="ghost"
              size="icon"
              icon={faPaperclip}
              aria-label="Attach pictures or videos"
              disabled={draft.length >= MAX_ATTACHMENTS}
              onClick={() => fileRef.current?.click()}
            />
            <label htmlFor="assistant-input" className="sr-only">
              Describe the vehicle you are looking for
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your search"
              className="max-h-40 min-h-10 flex-1 resize-none self-center overflow-y-auto border-0 bg-transparent px-2 py-2.5 text-sm leading-5 shadow-none outline-none placeholder:text-muted/70 focus:outline-none focus-visible:outline-none focus:ring-0"
            />
            <Button type="submit" variant="danger" icon={faPaperPlane} disabled={!canSend} aria-label="Send question">
              Search
            </Button>
          </div>
        </div>
        <p className={cn("mt-2 text-xs", attachError ? "text-danger-strong" : "text-muted")} role={attachError ? "alert" : undefined}>
          {attachError ?? "Enter to search, Shift+Enter for a new line. Searches the latest database records; pictures and videos are not analysed yet."}
        </p>
      </form>

      {showLog && (
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Search conversation"
          className="max-h-[26rem] space-y-4 overflow-y-auto border-t border-line bg-subtle p-5"
        >
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          {pending && (
            <p role="status" className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted">
              <FontAwesomeIcon icon={faSpinner} spin />
              Searching detections…
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
