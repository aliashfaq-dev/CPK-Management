import type { ReactNode } from "react";

interface PageHeaderProps {
  description: string;
  actions?: ReactNode;
}

/** The page title lives in the global Header; this adds context and actions. */
export function PageHeader({ description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-sm text-muted">{description}</p>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
