import { Button } from "@/components/ui/button";

/**
 * Says this view was not counted as the recipient's open, since a webhook rule
 * would report it to your app, and offers to count it (EM-27.2).
 */
export function ViewNotCountedNotice({
  onCountAsOpen,
}: {
  onCountAsOpen: () => void;
}) {
  return (
    <div
      role="note"
      className="mx-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning sm:mx-6"
    >
      <span>
        Viewing this email is not counted as an open, as a webhook rule would
        send email.opened to your app.
      </span>
      <Button type="button" size="sm" variant="outline" onClick={onCountAsOpen}>
        Count as an open
      </Button>
    </div>
  );
}
