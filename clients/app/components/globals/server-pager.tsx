import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PageMeta } from "@/types/api.types";

/**
 * Server-side pagination footer. Screens pass the `meta` block returned by a
 * list endpoint so paging never loads the whole table into the browser.
 */
export function ServerPager({
  meta,
  onPageChange,
  className,
}: {
  meta: PageMeta | undefined;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (!meta || meta.totalPages <= 1) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className={cn("flex items-center justify-between gap-4 pt-4", className)}>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{from}</span>
        <span className="mx-1">—</span>
        <span className="font-semibold text-foreground">{to}</span>
        <span className="mx-1.5">of</span>
        <span className="font-semibold text-foreground">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-muted border border-border rounded-md text-xs font-semibold text-foreground cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          <ChevronLeftIcon className="size-3.5" /> Prev
        </button>
        <span className="text-xs text-muted-foreground">
          Page {meta.page} of {meta.totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!meta.hasMore}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-muted border border-border rounded-md text-xs font-semibold text-foreground cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Next <ChevronRightIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
