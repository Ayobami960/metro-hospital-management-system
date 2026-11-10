import { useEffect, useState } from "react";

/**
 * Debounces a rapidly changing value (search boxes) so list queries only fire
 * once the user pauses, instead of on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
