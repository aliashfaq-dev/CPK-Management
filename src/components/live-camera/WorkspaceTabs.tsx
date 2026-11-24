"use client";

import { memo, type KeyboardEvent } from "react";
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { WorkspaceTab } from "@/types";
import { cn } from "@/lib/utils";

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeId: string;
  maxTabs: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

/**
 * Chrome-style tab strip. Every tab is `flex-1 min-w-0`, so opening more tabs shrinks them all equally inside one row
 * (no horizontal scrollbar); titles truncate and the × stays visible. Pinned tabs have no ×.
 */
function WorkspaceTabsComponent({ tabs, activeId, maxTabs, onSelect, onClose, onAdd }: WorkspaceTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === activeId);
    if (event.key === "Delete") {
      if (index >= 0 && !tabs[index].pinned) {
        event.preventDefault();
        onClose(activeId);
      }
      return;
    }
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const id = tabs[next].id;
    onSelect(id);
    document.getElementById(`tab-${id}`)?.focus();
  };

  // The pinned "All cameras" tab does not count toward the limit.
  const customCount = tabs.filter((tab) => !tab.pinned).length;

  return (
    <div className="flex items-end gap-1 border-b border-line bg-subtle px-2 pt-2">
      <div role="tablist" aria-label="Camera views" onKeyDown={onKeyDown} className="flex min-w-0 items-end gap-0.5 overflow-x-hidden">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              role="presentation"
              className={cn(
                "flex h-9 min-w-0 max-w-56 flex-1 items-center rounded-t-md border border-b-0 text-sm transition-colors",
                active ? "border-line bg-surface text-fg" : "border-transparent text-muted hover:bg-surface/70 hover:text-fg",
              )}
            >
              <button
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                title={tab.title}
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onSelect(tab.id)}
                className="h-full min-w-0 flex-1 truncate pl-3 pr-1 text-left font-medium"
              >
                {tab.title}
              </button>
              {!tab.pinned && (
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onClose(tab.id)}
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-line hover:text-fg"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-xs" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={customCount >= maxTabs}
        aria-label="New tab"
        title={customCount >= maxTabs ? `Up to ${maxTabs} tabs` : "New tab"}
        className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-line hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FontAwesomeIcon icon={faPlus} className="text-xs" />
      </button>
    </div>
  );
}

export const WorkspaceTabs = memo(WorkspaceTabsComponent);
