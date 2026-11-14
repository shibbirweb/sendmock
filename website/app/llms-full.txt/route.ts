import { join } from "node:path";

import { buildLlmsFullText } from "@/lib/install-with-ai/build-llms-full-text";
import { buildLlmsText } from "@/lib/install-with-ai/build-llms-text";
import { readInstallPrompt } from "@/lib/install-with-ai/read-install-prompt";
import { source } from "@/lib/source";

// Written once at export time into out/llms-full.txt (AI-06.1).
export const dynamic = "force-static";

export function GET() {
  const llmsText = buildLlmsText(
    readInstallPrompt(),
    source.getPages().map((docsPage) => ({
      title: docsPage.data.title ?? docsPage.url,
      description: docsPage.data.description,
      url: docsPage.url,
    })),
  );
  const llmsFullText = buildLlmsFullText(
    llmsText,
    join(process.cwd(), "content", "docs"),
  );

  return new Response(llmsFullText, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
