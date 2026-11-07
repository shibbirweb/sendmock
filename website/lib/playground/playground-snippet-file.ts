import { fileURLToPath } from "node:url";

/** Where the snippets CI runs against a real SendMock are kept. */
export const playgroundSnippetFilePath = fileURLToPath(
  new URL(
    "../../../examples/playground-snippets/playground-snippets.json",
    import.meta.url,
  ),
);
