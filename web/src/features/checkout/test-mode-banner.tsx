import { FlaskConicalIcon } from "lucide-react";

/** Always on top of a checkout page: nothing here moves real money (PY-01.4). */
export function TestModeBanner() {
  return (
    <div
      role="note"
      aria-label="Test mode"
      className="flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-sm font-semibold text-background"
    >
      <FlaskConicalIcon aria-hidden="true" className="size-4" />
      TEST MODE: no real payment. Use a test card or test wallet.
    </div>
  );
}
