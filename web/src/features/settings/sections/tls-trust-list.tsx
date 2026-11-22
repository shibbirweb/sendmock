import { Badge } from "@/components/ui/badge";
import { useTlsTrust } from "@/lib/api/hooks/use-system-queries";
import type { TlsTrustPlace } from "@/lib/api/types";

const stateLabels: Record<TlsTrustPlace["state"], string> = {
  trusted: "Trusted",
  missing: "Not yet",
  manual: "Set it yourself",
};

/** What trusts the local CA on this machine, as `sendmock trust --check` reports it (PL-25). */
export function TlsTrustList() {
  const trustQuery = useTlsTrust(true);
  const places = trustQuery.data?.places ?? [];

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Trusted by</p>
      <p className="text-xs text-muted-foreground">
        Run <code className="font-mono">sendmock trust</code> to add the CA
        where it is missing, and{" "}
        <code className="font-mono">sendmock trust --undo</code> to remove it
        again.
      </p>
      {trustQuery.isError ? (
        <p className="text-xs text-muted-foreground">
          No local CA yet, or this SendMock cannot read the trust stores.
        </p>
      ) : (
        <ul className="grid gap-1">
          {places.map((trustPlace) => (
            <li key={trustPlace.place} className="grid gap-0.5 text-sm">
              <span className="flex items-center gap-2">
                <Badge
                  variant={
                    trustPlace.state === "trusted" ? "secondary" : "outline"
                  }
                >
                  {stateLabels[trustPlace.state]}
                </Badge>
                {trustPlace.place}
              </span>
              <span className="text-xs break-all text-muted-foreground">
                {trustPlace.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
