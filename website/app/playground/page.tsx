import type { Metadata } from "next";

import { PlaygroundWorkbench } from "@/components/api/playground-workbench";
import { loadApiReference } from "@/lib/openapi/load-openapi";

export const metadata: Metadata = {
  title: "API playground",
  description:
    "Call any SendMock endpoint in your browser, watch the events it triggers and run multi-step scenarios.",
};

export default function PlaygroundPage() {
  const { operations, tagNames, schemas } = loadApiReference();

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold tracking-tight">API playground</h1>
        <p className="text-fd-muted-foreground">
          Demo mode: every request is answered in your browser by the mock API
          of the live demo, so nothing needs installing. Snippets point at a
          SendMock on its default address.
        </p>
      </header>
      <PlaygroundWorkbench
        operations={operations}
        tagNames={tagNames}
        schemas={schemas}
      />
    </main>
  );
}
