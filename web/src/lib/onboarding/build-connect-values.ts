import type { AppInfo } from "@/lib/api/types";
import {
  type AppLocation,
  appLocationHosts,
  readPort,
} from "@/lib/settings/build-connection-snippets";

/** Which part of SendMock a how to connect card is about. */
export type ConnectArea = "smtp" | "sms" | "verify" | "api" | "overview";

export type ConnectValue = {
  label: string;
  connectValue: string;
};

type ConnectTarget = {
  host: string;
  smtpPort: number;
  httpPort: number;
  providerPort: number | null;
};

const defaultSmtpPort = 1025;
const defaultHttpPort = 8025;

/** Host for where the app runs, ports from `/info`. */
export function readConnectTarget(
  appInfo: AppInfo | undefined,
  appLocation: AppLocation,
): ConnectTarget {
  const providerAddress = appInfo?.provider_address ?? null;

  return {
    host: appLocationHosts[appLocation],
    smtpPort: readPort(appInfo?.smtp_address ?? null, defaultSmtpPort),
    httpPort: readPort(appInfo?.http_address ?? null, defaultHttpPort),
    providerPort:
      providerAddress === null ? null : readPort(providerAddress, 0) || null,
  };
}

/** Provider SDK base URL: the provider port when on, else `/providers/<name>`. */
function buildProviderBaseUrl(
  connectTarget: ConnectTarget,
  providerName: string,
): string {
  if (connectTarget.providerPort !== null) {
    return `http://${connectTarget.host}:${connectTarget.providerPort}`;
  }

  return `http://${connectTarget.host}:${connectTarget.httpPort}/providers/${providerName}`;
}

/** The values an app needs for one area, ready to copy (UI-04.1). */
export function buildConnectValues(
  connectArea: ConnectArea,
  connectTarget: ConnectTarget,
): ConnectValue[] {
  const apiBaseUrl = `http://${connectTarget.host}:${connectTarget.httpPort}/api/v1`;
  const twilioBaseUrl = buildProviderBaseUrl(connectTarget, "twilio");

  switch (connectArea) {
    case "smtp":
      return [
        { label: "SMTP host", connectValue: connectTarget.host },
        { label: "SMTP port", connectValue: String(connectTarget.smtpPort) },
      ];
    case "sms":
      return [
        { label: "Native API", connectValue: `${apiBaseUrl}/sms` },
        { label: "Twilio base URL", connectValue: twilioBaseUrl },
        {
          label: "Vonage base URL",
          connectValue: buildProviderBaseUrl(connectTarget, "vonage"),
        },
      ];
    case "verify":
      return [
        { label: "Twilio base URL", connectValue: twilioBaseUrl },
        {
          label: "Start a verification",
          connectValue: "POST /v2/Services/{ServiceSid}/Verifications",
        },
      ];
    case "api":
      return [{ label: "API base URL", connectValue: apiBaseUrl }];
    case "overview":
      return [
        {
          label: "SMTP address",
          connectValue: `${connectTarget.host}:${connectTarget.smtpPort}`,
        },
        { label: "API base URL", connectValue: apiBaseUrl },
      ];
  }
}
