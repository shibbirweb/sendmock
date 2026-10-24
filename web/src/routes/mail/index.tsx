import { createFileRoute } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";

export const Route = createFileRoute("/mail/")({
  component: NoEmailSelected,
});

function NoEmailSelected() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <MailIcon className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Select an email to read it. Use J and K to move through the list.
      </p>
    </div>
  );
}
