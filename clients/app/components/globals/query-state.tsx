import { AlertCircleIcon, InboxIcon, RefreshCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Loader } from "@/components/globals/loader";
import { errorMessage } from "@/services/api/api-error";

/**
 * Reusable render states for TanStack Query screens.
 *
 * Every API-connected page renders the same loading card, the same retryable
 * error block and the same empty state instead of rolling its own, and a
 * failed request is never shown as "no records".
 */

export function QueryLoading({ text = "Loading…", className }: { text?: string; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl p-5", className)}>
      <Loader variant="card" text={text} />
    </div>
  );
}

export function QueryError({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center",
        className,
      )}
    >
      <AlertCircleIcon className="size-8 text-red-500/60" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-foreground">
          {errorMessage(error, "We could not load this data.")}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Check your connection and try again.
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-4 py-2 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer hover:bg-card transition-colors"
        >
          <RefreshCwIcon className="size-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function QueryEmpty({
  title = "Nothing to show yet",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-3 text-center",
        className,
      )}
    >
      <InboxIcon className="size-10 text-muted-foreground/30" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
      </div>
    </div>
  );
}

/** Inline table/list row used when a nested collection is empty. */
export function InlineEmpty({ text }: { text: string }) {
  return <div className="text-center py-6 text-xs text-muted-foreground">{text}</div>;
}
