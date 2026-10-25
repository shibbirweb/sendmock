import type { SnippetLanguage } from "@/lib/settings/build-connection-snippets";
import type { JsonValue } from "@/lib/settings/json-literals";

/** `"{{file:invoice.pdf}}"` in a body means "this file, base64 encoded". */
const filePlaceholderPattern = /^\{\{file:([^{}]+)\}\}$/;

export type FilePlaceholder = {
  fileName: string;
  /** The exact JSON string value, e.g. `{{file:invoice.pdf}}`. */
  placeholderText: string;
  /** Variable that holds the encoded file, named for the language. */
  variableName: string;
};

export function readFileName(stringValue: string): string | null {
  return filePlaceholderPattern.exec(stringValue)?.[1]?.trim() ?? null;
}

function collectFileNames(jsonValue: JsonValue, fileNames: string[]) {
  if (typeof jsonValue === "string") {
    const fileName = readFileName(jsonValue);
    if (fileName !== null && !fileNames.includes(fileName)) {
      fileNames.push(fileName);
    }
  } else if (Array.isArray(jsonValue)) {
    jsonValue.forEach((arrayItem) => collectFileNames(arrayItem, fileNames));
  } else if (jsonValue !== null && typeof jsonValue === "object") {
    Object.values(jsonValue).forEach((entryValue) =>
      collectFileNames(entryValue, fileNames),
    );
  }
}

function splitNameWords(fileName: string): string[] {
  return [...fileName.split(/[^A-Za-z0-9]+/).filter(Boolean), "content"];
}

function buildVariableName(
  language: SnippetLanguage,
  fileName: string,
): string {
  const nameWords = splitNameWords(fileName).map((nameWord) =>
    nameWord.toLowerCase(),
  );
  const camelName = nameWords
    .map((nameWord, wordIndex) =>
      wordIndex === 0
        ? nameWord
        : nameWord.charAt(0).toUpperCase() + nameWord.slice(1),
    )
    .join("");

  if (language === "python" || language === "ruby") {
    return nameWords.join("_");
  }
  if (language === "curl") {
    return nameWords.join("_").toUpperCase();
  }

  return language === "laravel" ? `$${camelName}` : camelName;
}

/** Every distinct file placeholder in a body, with a variable per file. */
export function findFilePlaceholders(
  language: SnippetLanguage,
  requestBody: JsonValue,
): FilePlaceholder[] {
  const fileNames: string[] = [];
  collectFileNames(requestBody, fileNames);

  return fileNames.map((fileName) => ({
    fileName,
    placeholderText: `{{file:${fileName}}}`,
    variableName: buildVariableName(language, fileName),
  }));
}

/** The line(s) that read a file and base64-encode it in each language. */
export function buildFileReadLines(
  language: SnippetLanguage,
  { fileName, variableName }: FilePlaceholder,
): string {
  const quotedName = JSON.stringify(fileName);
  const fileReadLines: Record<SnippetLanguage, string> = {
    laravel: `${variableName} = base64_encode(file_get_contents('${fileName.replaceAll("'", "\\'")}'));`,
    node: `const ${variableName} = fs.readFileSync(${quotedName}).toString("base64");`,
    python: `${variableName} = base64.b64encode(open(${quotedName}, "rb").read()).decode()`,
    go: `${variableName}Bytes, _ := os.ReadFile(${quotedName})\n${variableName} := base64.StdEncoding.EncodeToString(${variableName}Bytes)`,
    java: `var ${variableName} = Base64.getEncoder().encodeToString(Files.readAllBytes(Path.of(${quotedName})));`,
    ruby: `${variableName} = Base64.strict_encode64(File.binread(${quotedName}))`,
    dotnet: `var ${variableName} = Convert.ToBase64String(File.ReadAllBytes(${quotedName}));`,
    curl: `${variableName}=$(base64 < '${fileName.replaceAll("'", "'\\''")}' | tr -d '\\n')`,
  };

  return fileReadLines[language];
}
