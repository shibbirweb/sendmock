import {
  DownloadIcon,
  LinkIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScenarioReportView } from "@/features/scenarios/scenario-report";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import { ApiError } from "@/lib/api/api-client";
import {
  useRunCiFile,
  useValidateCiFile,
} from "@/lib/api/hooks/use-ci-queries";

const exampleCiFile = `{
  "sendmock": { "format": "sendmock.ci", "format_version": 1 },
  "app_url": "http://localhost:8000",
  "scenarios": [
    {
      "name": "SendMock answers",
      "steps": [{ "run": "http", "with": { "method": "GET", "url": "/api/v1/health" } }]
    }
  ]
}
`;

function downloadJunitReport(junitXml: string) {
  const reportUrl = URL.createObjectURL(
    new Blob([junitXml], { type: "application/xml" }),
  );
  const downloadLink = document.createElement("a");
  downloadLink.href = reportUrl;
  downloadLink.download = "sendmock-report.xml";
  downloadLink.click();
  URL.revokeObjectURL(reportUrl);
}

/** A CI file run here, as `sendmock ci run` runs it in a pipeline (WH-15.7). */
export function CiFileCard() {
  const fieldId = React.useId();
  const [ciText, setCiText] = React.useState(exampleCiFile);
  const [ciUrl, setCiUrl] = React.useState("");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const validateCiFile = useValidateCiFile();
  const runCiFile = useRunCiFile();
  const runError =
    runCiFile.error instanceof ApiError ? runCiFile.error.message : null;

  const importFromUrl = async () => {
    setLoadError(null);
    try {
      const response = await fetch(ciUrl);
      if (!response.ok) {
        throw new Error(`The URL answered ${response.status}`);
      }
      setCiText(await response.text());
    } catch (fetchError) {
      setLoadError(
        fetchError instanceof Error ? fetchError.message : String(fetchError),
      );
    }
  };

  return (
    <section
      aria-labelledby={`${fieldId}-heading`}
      className="grid gap-3 border-t pt-6"
    >
      <div className="grid gap-1">
        <h3 id={`${fieldId}-heading`} className="text-lg font-semibold">
          CI file
        </h3>
        <p className="text-sm text-muted-foreground">
          The setup, the app&apos;s URL and the scenarios a pipeline runs with{" "}
          <code className="font-mono">sendmock ci run</code>. Run it here to see
          the report your CI will show.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          type="url"
          aria-label="CI file URL"
          className="min-w-0 flex-1"
          placeholder="https://raw.githubusercontent.com/acme/shop/main/sendmock.ci.json"
          value={ciUrl}
          onChange={(changeEvent) => setCiUrl(changeEvent.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={ciUrl.trim() === ""}
          onClick={() => void importFromUrl()}
        >
          <LinkIcon />
          Import from URL
        </Button>
      </div>
      {loadError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}
      <CodeEditor
        value={ciText}
        onChange={setCiText}
        ariaLabel="CI file"
        language="text"
        templateReference={undefined}
        minHeightClassName="min-h-48"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={validateCiFile.isPending}
          onClick={() => validateCiFile.mutate(ciText)}
        >
          <ShieldCheckIcon />
          Validate CI file
        </Button>
        <Button
          type="button"
          disabled={runCiFile.isPending}
          onClick={() => runCiFile.mutate(ciText)}
        >
          <PlayIcon />
          {runCiFile.isPending ? "Running..." : "Run CI file"}
        </Button>
        {runCiFile.data !== undefined && (
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadJunitReport(runCiFile.data.junit_xml)}
          >
            <DownloadIcon />
            Download JUnit report
          </Button>
        )}
      </div>
      {validateCiFile.data !== undefined && (
        <p role="status" className="text-sm">
          {validateCiFile.data.is_valid
            ? `Valid: ${validateCiFile.data.scenario_count} scenarios.`
            : validateCiFile.data.problems.join(" ")}
        </p>
      )}
      {runError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {runError}
        </p>
      )}
      {runCiFile.data !== undefined && (
        <div className="grid gap-4">
          <p className="text-sm font-medium">
            {runCiFile.data.passed_count} of {runCiFile.data.scenarios.length}{" "}
            scenarios passed in {runCiFile.data.duration_ms} ms.
          </p>
          {runCiFile.data.scenarios.map((scenarioReport) => (
            <div key={scenarioReport.name} className="grid gap-2">
              <h4 className="text-sm font-semibold">{scenarioReport.name}</h4>
              <ScenarioReportView scenarioReport={scenarioReport} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
