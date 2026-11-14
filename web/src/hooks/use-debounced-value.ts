import * as React from "react";

/** The value once it has stopped changing for `delayMs`. */
export function useDebouncedValue<ValueType>(
  value: ValueType,
  delayMs: number,
): ValueType {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
