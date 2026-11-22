"use client";

import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEscape } from "@/hooks/useEscape";
import { Button } from "@/components/ui/Button";
import { SidebarBrand, SidebarNav } from "./Sidebar";

export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 bg-fg/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-line bg-surface">
        <div className="relative">
          <SidebarBrand />
          <Button
            variant="ghost"
            size="icon"
            icon={faXmark}
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute right-3 top-3"
          />
        </div>
        <SidebarNav onNavigate={onClose} />
      </div>
    </div>
  );
}
