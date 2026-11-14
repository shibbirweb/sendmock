// The smallest program that runs the playground's snippets in each language: the imports
// and `main` the snippet leaves out, and after each snippet one line printing
// `STATUS <label> <code>`, which the runner reads. A language is added here.

const indent = (code, spaces) =>
  code
    .split("\n")
    .map((line) => (line === "" ? line : `${" ".repeat(spaces)}${line}`))
    .join("\n");

const statusLine = (label) => `STATUS ${label}`;

const curlProgram = (snippetBlocks) => ({
  files: {
    "snippets.sh": snippetBlocks
      .map(
        ({ label, code }) =>
          `echo "${statusLine(label)} $(${code} \\\n  --silent --output /dev/null --write-out '%{http_code}')"`,
      )
      .join("\n"),
  },
  command: ["bash", ["-euo", "pipefail", "snippets.sh"]],
});

const javascriptProgram = (snippetBlocks) => ({
  files: {
    "snippets.mjs": snippetBlocks
      .map(
        ({ label, code }) =>
          `{\n${indent(code, 2)}\n  console.log("${statusLine(label)}", response.status);\n}`,
      )
      .join("\n"),
  },
  command: ["node", ["snippets.mjs"]],
});

const pythonProgram = (snippetBlocks) => ({
  files: {
    "snippets.py": snippetBlocks
      .map(
        ({ label, code }) =>
          `${code}\nprint()\nprint("${statusLine(label)}", response.status_code)`,
      )
      .join("\n\n"),
  },
  command: ["python", ["snippets.py"]],
});

// Guzzle comes with the Laravel app the workflow makes for the PHP recipes.
const phpProgram = (snippetBlocks) => ({
  files: {
    "snippets.php": [
      "<?php",
      "require getenv('LARAVEL_APP_FOLDER') . '/vendor/autoload.php';",
      ...snippetBlocks.map(
        ({ label, code }) =>
          `${code}\necho "\\n${statusLine(label)} " . $response->getStatusCode() . "\\n";`,
      ),
    ].join("\n\n"),
  },
  command: ["php", ["snippets.php"]],
});

const goProgram = (snippetBlocks) => {
  const goImports = ['"fmt"', '"net/http"'];
  if (snippetBlocks.some(({ code }) => code.includes("strings."))) {
    goImports.push('"strings"');
  }
  const goBlocks = snippetBlocks.map(({ label, code }) =>
    indent(
      `{\n${indent(code, 1)}\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Println("${statusLine(label)}", response.StatusCode)\n\tresponse.Body.Close()\n}`,
      1,
    ),
  );
  return {
    files: {
      "go.mod": "module snippets\n\ngo 1.22\n",
      "main.go": `package main\n\nimport (\n${goImports.map((goImport) => `\t${goImport}`).join("\n")}\n)\n\nfunc main() {\n${goBlocks.join("\n")}\n}\n`,
    },
    command: ["go", ["run", "."]],
  };
};

const javaProgram = (snippetBlocks) => {
  const javaBlocks = snippetBlocks.map(({ label, code }) =>
    indent(
      `{\n${indent(code, 4)}\n    System.out.println("${statusLine(label)} " + response.statusCode());\n}`,
      4,
    ),
  );
  return {
    files: {
      "Snippets.java": [
        "import java.net.URI;",
        "import java.net.http.HttpClient;",
        "import java.net.http.HttpRequest;",
        "import java.net.http.HttpResponse;",
        "",
        "public class Snippets {",
        "  public static void main(String[] arguments) throws Exception {",
        ...javaBlocks,
        "  }",
        "}",
        "",
      ].join("\n"),
    },
    command: ["java", ["Snippets.java"]],
  };
};

// The same crates as the Rust recipes, so their build cache is reused.
const rustCargoManifest = `[package]
name = "playground-snippets"
version = "0.0.0"
edition = "2021"
publish = false

[workspace]

[dependencies]
reqwest = { version = "0.12", features = ["json"] }
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
`;

const rustProgram = (snippetBlocks) => {
  const rustBlocks = snippetBlocks.map(({ label, code }) =>
    indent(
      `{\n${indent(code, 4)}\n    println!("${statusLine(label)} {}", response.status().as_u16());\n}`,
      4,
    ),
  );
  return {
    files: {
      "Cargo.toml": rustCargoManifest,
      "src/main.rs": `#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n${rustBlocks.join("\n")}\n    Ok(())\n}\n`,
    },
    command: ["cargo", ["run", "--quiet"]],
  };
};

const rubyProgram = (snippetBlocks) => ({
  files: {
    "snippets.rb": snippetBlocks
      .map(
        ({ label, code }) =>
          `${code}\nputs "${statusLine(label)} #{response.code}"`,
      )
      .join("\n\n"),
  },
  command: ["ruby", ["snippets.rb"]],
});

const csharpProject = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
`;

const csharpProgram = (snippetBlocks) => ({
  files: {
    "Snippets.csproj": csharpProject,
    "Program.cs": snippetBlocks
      .map(
        ({ label, code }) =>
          `{\n${indent(code, 4)}\n    Console.WriteLine($"${statusLine(label)} {(int)response.StatusCode}");\n}`,
      )
      .join("\n"),
  },
  command: ["dotnet", ["run", "--nologo"]],
});

/** Keyed by the recipe matrix's language names; its CLI row runs the cURL snippets. */
export const snippetPrograms = {
  cli: { snippetLanguage: "curl", buildProgram: curlProgram },
  javascript: {
    snippetLanguage: "javascript",
    buildProgram: javascriptProgram,
  },
  python: { snippetLanguage: "python", buildProgram: pythonProgram },
  php: { snippetLanguage: "php", buildProgram: phpProgram },
  go: { snippetLanguage: "go", buildProgram: goProgram },
  java: { snippetLanguage: "java", buildProgram: javaProgram },
  rust: { snippetLanguage: "rust", buildProgram: rustProgram },
  ruby: { snippetLanguage: "ruby", buildProgram: rubyProgram },
  csharp: { snippetLanguage: "csharp", buildProgram: csharpProgram },
};
