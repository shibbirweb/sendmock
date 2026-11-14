// How each language's recipe examples are saved and run; a language is added here.
import { join } from "node:path";

import { replaceAppNotes } from "./cli-app-steps.mjs";
import {
  csharpTestProject,
  goModule,
  rustCargoManifest,
} from "./recipe-project-files.mjs";

const toSnakeCase = (recipeSlug) => recipeSlug.replaceAll("-", "_");
const toPascalCase = (recipeSlug) =>
  recipeSlug
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

// JUnit 5 and Jackson come as jars the workflow downloads; their paths are in these variables.
const javaCompileAndTest = [
  'javac -d out -cp "$JAVA_TEST_CLASSPATH" $(find src -name "*.java")',
  'java -jar "$JUNIT_CONSOLE_JAR" execute --disable-banner --fail-if-no-tests --class-path "out:$JAVA_TEST_CLASSPATH" --scan-class-path out',
].join(" && ");

export const recipeLanguages = {
  javascript: {
    tabName: "JavaScript",
    helperPage: "connect/node.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) => `${recipeSlug}.test.js`,
    // Vitest is installed in the language's folder, which runs the recipe's file.
    buildCommand: (_recipeFolder, recipeFilePath) => [
      join(process.cwd(), "node_modules/.bin/vitest"),
      ["run", recipeFilePath, "--testTimeout=30000"],
      process.cwd(),
    ],
  },
  python: {
    tabName: "Python",
    helperPage: null,
    recipeFilePath: (recipeSlug) => `test_${toSnakeCase(recipeSlug)}.py`,
    buildCommand: (_recipeFolder, recipeFilePath) => [
      "python",
      ["-m", "pytest", "-q", recipeFilePath],
    ],
  },
  go: {
    tabName: "Go",
    helperPage: "connect/go.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) => `${toSnakeCase(recipeSlug)}_test.go`,
    extraFiles: {
      "go.mod": goModule,
    },
    buildCommand: () => ["go", ["test", "-count=1", "./..."]],
  },
  ruby: {
    tabName: "Ruby",
    helperPage: "connect/ruby.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) => `spec/${toSnakeCase(recipeSlug)}_spec.rb`,
    buildCommand: (_recipeFolder, recipeFilePath) => [
      "rspec",
      [recipeFilePath],
    ],
  },
  cli: {
    tabName: "CLI",
    helperPage: null,
    recipeFilePath: (recipeSlug) => `${recipeSlug}.sh`,
    prepareCode: replaceAppNotes,
    buildCommand: (_recipeFolder, recipeFilePath) => [
      "bash",
      ["-euo", "pipefail", recipeFilePath],
    ],
  },
  rust: {
    tabName: "Rust",
    helperPage: "connect/rust.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) => `tests/${toSnakeCase(recipeSlug)}.rs`,
    extraFiles: {
      "Cargo.toml": rustCargoManifest,
      "src/lib.rs": "",
    },
    buildCommand: () => ["cargo", ["test", "--quiet"]],
  },
  java: {
    tabName: "Java",
    helperPage: "connect/java.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) =>
      `src/test/java/${toPascalCase(recipeSlug)}Test.java`,
    buildCommand: () => ["bash", ["-c", javaCompileAndTest]],
  },
  csharp: {
    tabName: "C#",
    helperPage: "connect/dotnet.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) => `${toPascalCase(recipeSlug)}Tests.cs`,
    extraFiles: {
      "RecipeExample.csproj": csharpTestProject,
    },
    buildCommand: () => ["dotnet", ["test", "--nologo"]],
  },
  // Pest feature tests run inside one Laravel app the workflow makes, named by this variable.
  php: {
    tabName: "PHP",
    helperPage: null,
    readSharedFolder: () => process.env.LARAVEL_APP_FOLDER ?? "",
    recipeFilePath: (recipeSlug) =>
      `tests/Feature/${toPascalCase(recipeSlug)}Test.php`,
    buildCommand: (_recipeFolder, recipeFilePath) => [
      "vendor/bin/pest",
      [recipeFilePath],
    ],
  },
};
