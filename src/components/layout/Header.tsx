"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  faBars,
  faBell,
  faCalendarDays,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NAV_ITEMS } from "@/data/navigation";
import type { AppNotification, User } from "@/types";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";
import { isActivePath } from "./Sidebar";

interface HeaderProps {
  user: User;
  notifications: AppNotification[];
  onMenuClick: () => void;
}

const toneDot: Record<AppNotification["tone"], string> = {
  info: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function Header({ user, notifications, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const current = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/detections?q=${encodeURIComponent(trimmed)}` : "/detections");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <Button variant="ghost" size="icon" icon={faBars} aria-label="Open navigation" className="md:hidden" onClick={onMenuClick} />

      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="hidden text-xs text-muted sm:block">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-fg">
                Home
              </Link>
            </li>
            {current && current.href !== "/" && (
              <>
                <li aria-hidden="true">
                  <FontAwesomeIcon icon={faChevronRight} className="text-[9px]" />
                </li>
                <li aria-current="page" className="text-fg">
                  {current.label}
                </li>
              </>
            )}
          </ol>
        </nav>
        <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{current?.label ?? "Vehicle Tracking"}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <form onSubmit={onSearch} role="search" className="hidden w-64 md:block">
          <SearchInput value={query} onChange={setQuery} placeholder="Search plates…" label="Search license plates" />
        </form>

        {now && (
          <div className="hidden items-center gap-2 px-2 text-xs text-muted xl:flex">
            <FontAwesomeIcon icon={faCalendarDays} />
            <time dateTime={now.toISOString()}>{dateFormat.format(now)}</time>
          </div>
        )}

        <Popover
          label="Notifications"
          buttonClassName="relative w-9 justify-center"
          panelClassName="w-80 max-w-[calc(100vw-2rem)]"
          trigger={
            <>
              <FontAwesomeIcon icon={faBell} />
              {notifications.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
              )}
            </>
          }
        >
          {(close) => (
            <div>
              <div className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</div>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {notifications.map((item) => (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", toneDot[item.tone])} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted">{item.description}</p>
                      <p className="mt-1 text-xs text-muted">{item.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/settings" onClick={close} className="block border-t border-line px-4 py-3 text-center text-sm font-medium text-accent hover:bg-subtle">
                Notification settings
              </Link>
            </div>
          )}
        </Popover>

        <Popover
          label="Account menu"
          buttonClassName="gap-2 px-1.5 text-fg"
          panelClassName="w-64"
          trigger={
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {user.initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight">{user.name}</span>
                <span className="block text-xs leading-tight text-muted">{user.role}</span>
              </span>
              <FontAwesomeIcon icon={faChevronDown} className="hidden text-[10px] text-muted sm:block" />
            </>
          }
        >
          {(close) => (
            <div>
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <ul className="p-1.5 text-sm">
                {["Profile settings", "Notification preferences", "Camera settings"].map((label) => (
                  <li key={label}>
                    <Link href="/settings" onClick={close} className="block rounded-md px-3 py-2 hover:bg-subtle">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}
