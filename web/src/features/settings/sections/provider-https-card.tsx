import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  useAppInfo,
  useDownloadTlsCa,
} from "@/lib/api/hooks/use-system-queries";

const certificateFileName = "sendmock-provider-ca.pem";

function saveCertificate(certificatePem: string) {
  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(
    new Blob([certificatePem], { type: "application/x-pem-file" }),
  );
  downloadLink.download = certificateFileName;
  downloadLink.click();
  URL.revokeObjectURL(downloadLink.href);
}

/** The provider APIs over HTTPS and the local CA to trust for them (PL-20.3). */
export function ProviderHttpsCard() {
  const providerTlsAddress = useAppInfo().data?.provider_tls_address ?? null;
  const downloadTlsCa = useDownloadTlsCa();
  const httpsUrl =
    providerTlsAddress === null ? null : `https://${providerTlsAddress}`;

  return (
    <SettingsSectionCard
      title="Provider APIs over HTTPS"
      description="For SDKs that only speak HTTPS, such as Laravel's mailgun mailer. Trust SendMock's local CA once, then point the SDK at this address."
    >
      {httpsUrl === null ? (
        <p className="text-sm text-muted-foreground">
          Off. Start SendMock with{" "}
          <code className="font-mono">--provider-tls-addr 127.0.0.1:8027</code>{" "}
          to serve the provider APIs over HTTPS.
        </p>
      ) : (
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-sm">
            <code className="font-mono">{httpsUrl}</code>
            <CopyButton copyText={httpsUrl} label="Copy the HTTPS address" />
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={downloadTlsCa.isPending}
            onClick={() => {
              downloadTlsCa.mutate(undefined, {
                onSuccess: (certificateAuthority) =>
                  saveCertificate(certificateAuthority.pem),
                onError: () =>
                  toast.error(
                    "SendMock has no local CA: it uses the certificate you gave it",
                  ),
              });
            }}
          >
            <DownloadIcon />
            Download the CA
          </Button>
        </div>
      )}
    </SettingsSectionCard>
  );
}
