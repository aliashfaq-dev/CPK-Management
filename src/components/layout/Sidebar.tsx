"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { faAnglesLeft, faAnglesRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NAV_ITEMS } from "@/data/navigation";
import { cn } from "@/lib/utils";

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="border-b border-line p-4">
      <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
        <Image
          src="/images/cpk-logo.jpeg"
          alt="CPK Community Policing Karachi logo"
          width={230}
          height={244}
          priority
          className={cn("w-auto shrink-0 object-contain", collapsed ? "h-9" : "h-12")}
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-bold leading-none text-accent">
              CPK
              <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">KARACHI</span>
            </p>
            <p className="mt-1.5 text-xs font-semibold leading-tight">Community Policing Karachi</p>
          </div>
        )}
      </div>
      {!collapsed && (
        <p className="mt-3 rounded-md border border-line bg-subtle px-3 py-2 text-xs text-muted">Together for a Safer Karachi</p>
      )}
    </div>
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
      {!collapsed && <p className="px-3 pb-2 pt-1 text-xs font-semibold text-muted">Workspace pages</p>}
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active ? "bg-accent text-white" : "text-muted hover:bg-subtle hover:text-fg",
                )}
              >
                <FontAwesomeIcon icon={item.icon} className="w-4 shrink-0" />
                {collapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  <>
                    {item.label}
                    
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-72",
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted transition-colors hover:bg-subtle hover:text-fg",
            collapsed && "justify-center px-0",
          )}
        >
          <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} className="w-4" />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
