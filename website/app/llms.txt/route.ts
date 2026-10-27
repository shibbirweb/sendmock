import { buildLlmsText } from "@/lib/install-with-ai/build-llms-text";
import { readInstallPrompt } from "@/lib/install-with-ai/read-install-prompt";
import { source } from "@/lib/source";

// Written once at export time into out/llms.txt (WS-09.3).
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

  return new Response(llmsText, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
