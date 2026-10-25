import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import { buildCatchUrl } from "@/lib/http/build-catch-url";

const fallbackHttpAddress = "127.0.0.1:8025";

/** The catch URL of a bin, from the address SendMock listens on. */
export function useCatchUrl(binName: string): string {
  const httpAddress = useAppInfo().data?.http_address ?? fallbackHttpAddress;

  return buildCatchUrl(httpAddress, binName);
}
