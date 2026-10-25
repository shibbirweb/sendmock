import { RotateCcwIcon } from "lucide-react";
import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type OptionalBodyField,
  RequestBodyEditor,
} from "@/features/settings/connection/request-body-editor";
import { RequestHeadersEditor } from "@/features/settings/connection/request-headers-editor";
import { useRequestCustomization } from "@/features/settings/connection/use-request-customization";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import {
  type AppLocation,
  appLocationHosts,
  buildConnectionSnippets,
  readPort,
  type SnippetLanguage,
  snippetLanguageLabels,
  snippetLanguages,
} from "@/lib/settings/build-connection-snippets";

const appLocationLabels: Record<AppLocation, string> = {
  "this-machine": "On this machine",
  "docker-host": "In a container, SendMock on the host",
  compose: "In the same Docker Compose project",
};

/** Optional `/send` fields of the native API, with example values. */
const optionalEmailFields: OptionalBodyField[] = [
  { fieldName: "cc", exampleValue: ["team@example.com"] },
  { fieldName: "bcc", exampleValue: ["audit@example.com"] },
  { fieldName: "text", exampleValue: "Hello" },
  { fieldName: "tags", exampleValue: ["welcome"] },
  { fieldName: "headers", exampleValue: { "X-Campaign": "spring" } },
  {
    fieldName: "attachments",
    exampleValue: [
      {
        filename: "invoice.pdf",
        content: "{{file:invoice.pdf}}",
        content_type: "application/pdf",
      },
    ],
  },
];

/** Optional `/sms` fields of the native API, with example values. */
const optionalSmsFields: OptionalBodyField[] = [
  {
    fieldName: "status_callback",
    exampleValue: "http://localhost:8000/sms/status",
  },
  { fieldName: "metadata", exampleValue: { order_id: 42 } },
  {
    fieldName: "media",
    exampleValue: [
      {
        filename: "photo.jpg",
        content: "{{file:photo.jpg}}",
        content_type: "image/jpeg",
      },
    ],
  },
  {
    fieldName: "media_urls",
    exampleValue: ["https://example.com/photos/parcel.jpg"],
  },
];

const defaultSmtpPort = 1025;
const defaultHttpPort = 8025;

/** Copy-ready setup for SMTP, the email and SMS APIs and the catcher (PL-05.5). */
export function ConnectionSection() {
  const fieldIdPrefix = React.useId();
  const appInfoQuery = useAppInfo();
  const [language, setLanguage] = React.useState<SnippetLanguage>("laravel");
  const [appLocation, setAppLocation] =
    React.useState<AppLocation>("this-machine");
  const requestEditor = useRequestCustomization();
  const connectionSnippets = buildConnectionSnippets(
    language,
    {
      host: appLocationHosts[appLocation],
      smtpPort: readPort(
        appInfoQuery.data?.smtp_address ?? null,
        defaultSmtpPort,
      ),
      httpPort: readPort(
        appInfoQuery.data?.http_address ?? null,
        defaultHttpPort,
      ),
    },
    requestEditor.requestCustomization,
  );

  return (
    <SettingsSectionCard
      title="Connect your app"
      description="Point your app at SendMock. Provider SDK recipes (Twilio, SendGrid, ...) are in the docs."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Language" fieldId={`${fieldIdPrefix}-language`}>
          <Select
            value={language}
            onValueChange={(nextLanguage) =>
              setLanguage(nextLanguage as SnippetLanguage)
            }
          >
            <SelectTrigger id={`${fieldIdPrefix}-language`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {snippetLanguages.map((snippetLanguage) => (
                <SelectItem key={snippetLanguage} value={snippetLanguage}>
                  {snippetLanguageLabels[snippetLanguage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Where does your app run?"
          fieldId={`${fieldIdPrefix}-location`}
        >
          <Select
            value={appLocation}
            onValueChange={(nextLocation) =>
              setAppLocation(nextLocation as AppLocation)
            }
          >
            <SelectTrigger id={`${fieldIdPrefix}-location`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(appLocationLabels) as AppLocation[]).map(
                (locationOption) => (
                  <SelectItem key={locationOption} value={locationOption}>
                    {appLocationLabels[locationOption]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <details className="group/customize rounded-lg border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Customize the request
          <span className="ml-2 font-normal text-muted-foreground">
            headers and payload fields for the API snippets
          </span>
        </summary>
        <div className="grid gap-5 border-t p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Changes here only shape the snippets below; nothing is sent.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!requestEditor.isCustomized}
              onClick={requestEditor.resetCustomization}
            >
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
          <RequestHeadersEditor
            headerRows={requestEditor.headerRows}
            onAdd={requestEditor.addHeaderRow}
            onUpdate={requestEditor.updateHeaderRow}
            onRemove={requestEditor.removeHeaderRow}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <RequestBodyEditor
              label="Email body (POST /api/v1/send)"
              bodyState={requestEditor.emailBody}
              optionalFields={optionalEmailFields}
              hint={
                'Use "{{file:invoice.pdf}}" as a value to read and base64-encode that file in the snippets.'
              }
              onBodyTextChange={requestEditor.setEmailBodyText}
              onAddField={requestEditor.addEmailBodyField}
            />
            <RequestBodyEditor
              label="SMS body (POST /api/v1/sms)"
              bodyState={requestEditor.smsBody}
              optionalFields={optionalSmsFields}
              hint="Media makes it an MMS (or WhatsApp media): up to 10 files, 5 MB in total."
              onBodyTextChange={requestEditor.setSmsBodyText}
              onAddField={requestEditor.addSmsBodyField}
            />
          </div>
        </div>
      </details>
      <div className="grid gap-4">
        {connectionSnippets.map((connectionSnippet) => (
          <section
            key={connectionSnippet.area}
            aria-label={connectionSnippet.title}
            className="grid gap-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">{connectionSnippet.title}</h4>
              <CopyButton
                copyText={connectionSnippet.code}
                label={`Copy ${connectionSnippet.title} snippet`}
              />
            </div>
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
              {connectionSnippet.code}
            </pre>
          </section>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
