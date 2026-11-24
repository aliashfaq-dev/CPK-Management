"use client";

import { memo, useEffect, useState } from "react";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatNavbarDateTime } from "@/lib/formatTime";

function NavbarClockComponent() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hidden items-center gap-2 px-2 text-xs text-muted xl:flex" aria-label="Current date and time">
      <FontAwesomeIcon icon={faCalendarDays} />
      {now ? <time dateTime={now.toISOString()}>{formatNavbarDateTime(now)}</time> : <span className="inline-block h-4 w-36" aria-hidden="true" />}
    </div>
  );
}

export const NavbarClock = memo(NavbarClockComponent);
