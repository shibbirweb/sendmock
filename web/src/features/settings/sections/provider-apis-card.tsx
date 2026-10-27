import { Link } from "@tanstack/react-router";

import { CopyButton } from "@/components/common/copy-button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useMessageProviders } from "@/lib/api/hooks/use-message-provider-queries";
import type {
  MessageProviderArea,
  MessageProviderDefinition,
} from "@/lib/api/types";

/** The main port's provider routes; the provider port serves the real paths. */
const mainPortProvidersUrl = "http://127.0.0.1:8025/providers";

function ProviderApiRows({
  providerArea,
  messageProviders,
}: {
  providerArea: MessageProviderArea;
  messageProviders: MessageProviderDefinition[];
}) {
  return (
    <ul className="grid gap-1">
      {messageProviders.map((messageProvider) => {
        const baseUrl = `${mainPortProvidersUrl}/${messageProvider.key}`;

        return (
          <li
            key={messageProvider.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: messageProvider.accent }}
              />
              <Link
                to={
                  providerArea === "email"
                    ? "/mail/providers"
                    : "/sms/providers"
                }
                search={{ provider: messageProvider.key }}
                className="font-medium hover:underline"
              >
                {messageProvider.name}
              </Link>
              <code className="truncate font-mono text-xs text-muted-foreground">
                {baseUrl}
              </code>
            </span>
            <CopyButton
              copyText={baseUrl}
              label={`Copy the ${messageProvider.name} base URL`}
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Every enabled provider, custom ones included, with the base URL its SDK
 * points at (docs/plan/22, Elsewhere).
 */
export function ProviderApisCard() {
  const isActive = (messageProvider: MessageProviderDefinition) =>
    messageProvider.is_enabled && !messageProvider.is_removed;
  const emailProviders = (useMessageProviders("email").data ?? []).filter(
    isActive,
  );
  const smsProviders = (useMessageProviders("sms").data ?? []).filter(isActive);

  return (
    <SettingsSectionCard
      title="Provider APIs"
      description="Point a provider's SDK at SendMock: use this base URL, or the real path on the provider port (127.0.0.1:8026). Change, remove or add providers in Mail > Providers and SMS > Providers."
    >
      <section aria-label="Email provider APIs" className="grid gap-1.5">
        <h4 className="text-sm font-medium">Email</h4>
        <ProviderApiRows
          providerArea="email"
          messageProviders={emailProviders}
        />
      </section>
      <section aria-label="SMS provider APIs" className="grid gap-1.5">
        <h4 className="text-sm font-medium">SMS</h4>
        <ProviderApiRows providerArea="sms" messageProviders={smsProviders} />
      </section>
    </SettingsSectionCard>
  );
}
