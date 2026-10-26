import { MoreHorizontalIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MessageProviderDefinition } from "@/lib/api/types";

/** What a row's menu can ask for; each is confirmed first. */
export type ProviderRowAction = "reset" | "remove" | "delete";

/** The area's active providers with their state (EM-18.1, SM-16.1). */
export function MessageProvidersTable({
  messageProviders,
  onEdit,
  onToggle,
  onAction,
}: {
  messageProviders: MessageProviderDefinition[];
  onEdit?: (messageProvider: MessageProviderDefinition) => void;
  onToggle: (
    messageProvider: MessageProviderDefinition,
    isEnabled: boolean,
  ) => void;
  onAction: (
    messageProvider: MessageProviderDefinition,
    rowAction: ProviderRowAction,
  ) => void;
}) {
  return (
    <Table aria-label="Providers">
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead className="hidden sm:table-cell">Key</TableHead>
          <TableHead className="hidden md:table-cell">Last 24 hours</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {messageProviders.map((messageProvider) => (
          <TableRow
            key={messageProvider.key}
            data-testid="message-provider-row"
          >
            <TableCell>
              <span className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: messageProvider.accent }}
                />
                <span className="font-medium">{messageProvider.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {messageProvider.is_builtin ? "Built-in" : "Custom"}
                </Badge>
                {messageProvider.is_modified && (
                  <Badge variant="secondary" className="text-[10px]">
                    Modified
                  </Badge>
                )}
              </span>
            </TableCell>
            <TableCell className="hidden font-mono text-xs sm:table-cell">
              {messageProvider.key}
            </TableCell>
            <TableCell className="hidden text-xs text-muted-foreground tabular-nums md:table-cell">
              {messageProvider.message_count_24h}{" "}
              {messageProvider.message_count_24h === 1 ? "message" : "messages"}
            </TableCell>
            <TableCell>
              <Switch
                aria-label={`${messageProvider.name} enabled`}
                checked={messageProvider.is_enabled}
                onCheckedChange={(isEnabled) =>
                  onToggle(messageProvider, isEnabled)
                }
              />
            </TableCell>
            <TableCell>
              <span className="flex items-center justify-end gap-1">
                {onEdit !== undefined && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${messageProvider.name}`}
                    onClick={() => onEdit(messageProvider)}
                  >
                    <PencilIcon />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`More for ${messageProvider.name}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {messageProvider.is_builtin && (
                      <DropdownMenuItem
                        disabled={!messageProvider.is_modified}
                        onSelect={() => onAction(messageProvider, "reset")}
                      >
                        Reset to default
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        onAction(
                          messageProvider,
                          messageProvider.is_builtin ? "remove" : "delete",
                        )
                      }
                    >
                      {messageProvider.is_builtin ? "Remove" : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
