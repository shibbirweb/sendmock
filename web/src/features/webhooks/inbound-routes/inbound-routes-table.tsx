import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InboundRoute } from "@/lib/api/types";

/** Routes in the order they run, with their Mailgun expression and actions (WH-12.7). */
export function InboundRoutesTable({
  inboundRoutes,
  onMove,
  onEdit,
  onDelete,
}: {
  inboundRoutes: InboundRoute[];
  onMove: (routeIndex: number, isMovingUp: boolean) => void;
  onEdit: (inboundRoute: InboundRoute) => void;
  onDelete: (inboundRoute: InboundRoute) => void;
}) {
  return (
    <Table aria-label="Inbound routes">
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Priority</TableHead>
          <TableHead>Route</TableHead>
          <TableHead className="hidden md:table-cell">Actions</TableHead>
          <TableHead className="w-40" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {inboundRoutes.map((inboundRoute, routeIndex) => {
          const routeName = inboundRoute.description || inboundRoute.expression;

          return (
            <TableRow key={inboundRoute.id} data-testid="inbound-route-row">
              <TableCell className="font-mono text-sm">
                {inboundRoute.priority}
              </TableCell>
              <TableCell>
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {inboundRoute.description || "Untitled route"}
                  </span>
                  <code className="font-mono text-xs break-all text-muted-foreground">
                    {inboundRoute.expression}
                  </code>
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="flex flex-wrap gap-1">
                  {inboundRoute.action_expressions.map(
                    (actionExpression, actionIndex) => (
                      <Badge
                        key={actionIndex}
                        variant="outline"
                        className="block max-w-72 truncate text-left font-mono text-[10px]"
                      >
                        {actionExpression}
                      </Badge>
                    ),
                  )}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${routeName} up`}
                    disabled={routeIndex === 0}
                    onClick={() => onMove(routeIndex, true)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${routeName} down`}
                    disabled={routeIndex === inboundRoutes.length - 1}
                    onClick={() => onMove(routeIndex, false)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${routeName}`}
                    onClick={() => onEdit(inboundRoute)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${routeName}`}
                    onClick={() => onDelete(inboundRoute)}
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
