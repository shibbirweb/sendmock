import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectHint } from "@/features/onboarding/connect-hint";

/** Where to point an app: the SMTP address and the API base URL (UI-03.5). */
export function ConnectCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your app</CardTitle>
        <CardDescription>
          Point your app's mail and SMS settings here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectHint
          connectArea="overview"
          className="max-w-none border-0 bg-transparent p-0"
        />
      </CardContent>
    </Card>
  );
}
