import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";

function ConnectionValue({
  label,
  connectionValue,
}: {
  label: string;
  connectionValue: string;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-0.5 pl-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">
          {connectionValue}
        </code>
        <CopyButton copyText={connectionValue} label={`Copy ${label}`} />
      </div>
    </div>
  );
}

/** Where to point an app: the SMTP address and the API base URL (UI-03.5). */
export function ConnectCard() {
  const appInfoQuery = useAppInfo();
  const appInfo = appInfoQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your app</CardTitle>
        <CardDescription>
          Point your app's mail and SMS settings here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {appInfo === undefined ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <ConnectionValue
              label="SMTP address"
              connectionValue={appInfo.smtp_address}
            />
            <ConnectionValue
              label="API base URL"
              connectionValue={`http://${appInfo.http_address}/api/v1`}
            />
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings" search={{ section: "connection" }}>
            Snippets for your language
            <ArrowRightIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
