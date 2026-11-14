import { PencilIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ChipListInput } from "@/components/common/chip-list-input";
import { IconButton } from "@/components/common/icon-button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateEmail } from "@/lib/api/hooks/use-email-queries";
import type { EmailDetail } from "@/lib/api/types";

/** Adds and removes an email's manual tags (EM-12.4). */
export function EmailTagsEditor({ email }: { email: EmailDetail }) {
  const [isOpen, setOpen] = React.useState(false);
  const [draftTags, setDraftTags] = React.useState(email.tags);
  const updateEmail = useUpdateEmail();
  const inputId = `email-tags-${email.id}`;

  const saveTags = () => {
    updateEmail.mutate(
      { emailId: email.id, emailUpdate: { tags: draftTags } },
      {
        onSuccess: () => {
          setOpen(false);
          toast("Tags saved");
        },
        onError: (saveError) => {
          toast.error(`Tags not saved: ${saveError.message}`);
        },
      },
    );
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDraftTags(email.tags);
        }
      }}
    >
      <PopoverTrigger asChild>
        <IconButton variant="ghost" size="icon-sm" label="Edit tags">
          <PencilIcon />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-72 gap-3">
        <label htmlFor={inputId} className="text-sm font-medium">
          Tags
        </label>
        <ChipListInput
          inputId={inputId}
          values={draftTags}
          placeholder="Add a tag and press Enter"
          onChange={(nextTags) => {
            setDraftTags([
              ...new Set(
                nextTags.map((tagName) => tagName.trim().toLowerCase()),
              ),
            ]);
          }}
        />
        <Button
          size="sm"
          className="justify-self-end"
          disabled={updateEmail.isPending}
          onClick={saveTags}
        >
          Save tags
        </Button>
      </PopoverContent>
    </Popover>
  );
}
