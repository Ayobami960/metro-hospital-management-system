
import type { ReactNode } from "react";

interface SelectValueLabelProps<T> {
  /** Currently selected value — "" / null means nothing is selected yet */
  value?: string | null;
  /** Options list to look the label up in (may still be loading) */
  items?: readonly T[] | null;
  /** Returns the stored value for an option */
  getValue: (item: T) => string;
  /** Returns the display label for an option */
  getLabel: (item: T) => ReactNode;
}

export function SelectValueLabel<T>({
  value,
  items,
  getValue,
  getLabel,
}: SelectValueLabelProps<T>) {
  // Nothing selected yet → let the placeholder show
  if (!value) return undefined;
  // Options not loaded yet → fall back to the raw value (same behavior as the
  // existing selectedYearLabel fallbacks) so the trigger never renders empty
  if (!items || items.length === 0) return value;
  const item = items.find((i) => getValue(i) === value);
  return item ? getLabel(item) : value;
}
