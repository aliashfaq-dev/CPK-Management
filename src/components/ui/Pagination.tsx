import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const first = Math.max(1, Math.min(page - 2, pageCount - 4));
  const last = Math.min(pageCount, first + 4);
  const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row">
      <p className="text-xs text-muted">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" icon={faChevronLeft} aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            aria-current={number === page ? "page" : undefined}
            onClick={() => onPageChange(number)}
            className={cn(
              "h-9 min-w-9 rounded-md px-2 text-sm font-medium transition-colors",
              number === page ? "bg-accent-soft text-accent" : "text-muted hover:bg-subtle hover:text-fg",
            )}
          >
            {number}
          </button>
        ))}
        <Button variant="ghost" size="icon" icon={faChevronRight} aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
      </div>
    </nav>
  );
}
