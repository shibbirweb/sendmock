"use client";

import { useState } from "react";

import { localInstanceUrl } from "@/lib/playground/local-instance";
import { useDemoBridge } from "@/lib/playground/demo-bridge-provider";

type TargetChoice = "demo" | "local" | "custom";

const targetChoices: { choice: TargetChoice; label: string }[] = [
  { choice: "demo", label: "Demo" },
  { choice: "local", label: "Your local SendMock" },
  { choice: "custom", label: "Custom URL" },
];

/**
 * Where requests go: the in-browser demo (the default), a SendMock on this machine, or
 * any reachable one with an API token. Nothing reaches an instance before Connect.
 */
export function TargetPicker() {
  const { instanceConnection, connectInstance, selectDemoTarget } =
    useDemoBridge();
  const [targetChoice, setTargetChoice] = useState<TargetChoice>("demo");
  const [instanceUrl, setInstanceUrl] = useState(localInstanceUrl);
  const [apiToken, setApiToken] = useState("");

  return (
    <section aria-label="Target" className="grid gap-3 rounded-xl border p-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-sm font-medium">Send requests to</legend>
        {targetChoices.map(({ choice, label }) => (
          <label key={choice} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="playground-target"
              value={choice}
              checked={targetChoice === choice}
              onChange={() => {
                setTargetChoice(choice);
                setInstanceUrl(localInstanceUrl);
                if (choice === "demo") {
                  selectDemoTarget();
                }
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {targetChoice !== "demo" && (
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            void connectInstance(
              instanceUrl.trim(),
              apiToken.trim() === "" ? null : apiToken.trim(),
            );
          }}
        >
          <label className="grid gap-1 text-sm">
            SendMock URL
            <input
              value={instanceUrl}
              onChange={(changeEvent) =>
                setInstanceUrl(changeEvent.target.value)
              }
              className="rounded-md border bg-fd-background px-2 py-1.5 font-mono text-xs"
            />
          </label>
          {targetChoice === "custom" ? (
            <label className="grid gap-1 text-sm">
              API token (when UI auth is on)
              <input
                type="password"
                value={apiToken}
                onChange={(changeEvent) =>
                  setApiToken(changeEvent.target.value)
                }
                className="rounded-md border bg-fd-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
          ) : (
            <p className="text-xs text-fd-muted-foreground">
              Your browser may ask to let this page reach your local network;
              allow it to connect.
            </p>
          )}
          <button
            type="submit"
            disabled={instanceConnection.status === "connecting"}
            className="rounded-md bg-fd-primary px-4 py-1.5 text-sm font-medium text-fd-primary-foreground disabled:opacity-50"
          >
            {instanceConnection.status === "connecting"
              ? "Connecting..."
              : "Connect"}
          </button>
        </form>
      )}
      <div aria-live="polite" className="text-sm">
        {instanceConnection.status === "connected" && (
          <p>Connected to SendMock {instanceConnection.version}.</p>
        )}
        {instanceConnection.status === "failed" && (
          <p role="alert" className="text-fd-error">
            {instanceConnection.explanation}
          </p>
        )}
      </div>
    </section>
  );
}
