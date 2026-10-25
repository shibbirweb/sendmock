import { ContainerIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import { isLoopbackUrl, toDockerHostUrl } from "@/lib/webhooks/docker-host-url";

/** True when SendMock runs in Docker and the URL points at loopback (WH-01.4). */
export function useIsDockerLoopbackUrl(endpointUrl: string): boolean {
  const appInfoQuery = useAppInfo();

  return appInfoQuery.data?.is_container === true && isLoopbackUrl(endpointUrl);
}

/** Explains why `localhost` fails from a container and offers the fix. */
export function DockerHostHint({
  endpointUrl,
  onUseDockerHost,
}: {
  endpointUrl: string;
  onUseDockerHost: (dockerHostUrl: string) => void;
}) {
  const isDockerLoopbackUrl = useIsDockerLoopbackUrl(endpointUrl);
  if (!isDockerLoopbackUrl) {
    return null;
  }

  const dockerHostUrl = toDockerHostUrl(endpointUrl);

  return (
    <div
      role="note"
      className="flex flex-wrap items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-xs"
    >
      <ContainerIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        SendMock runs in Docker, where <code>localhost</code> is the container
        itself. To reach an app on your machine, use{" "}
        <code className="break-all">{dockerHostUrl}</code>.
      </p>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => {
          onUseDockerHost(dockerHostUrl);
        }}
      >
        Use host.docker.internal
      </Button>
    </div>
  );
}
