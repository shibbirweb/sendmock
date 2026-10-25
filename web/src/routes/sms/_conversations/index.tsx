import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareIcon } from "lucide-react";

export const Route = createFileRoute("/sms/_conversations/")({
  component: NoThreadSelected,
});

function NoThreadSelected() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <MessageSquareIcon className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Select a conversation to read it. Use J and K to move through the list.
      </p>
    </div>
  );
}
