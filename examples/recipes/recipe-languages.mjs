// How each language's recipe examples are saved and run; a language is added here.
import { join } from "node:path";

import { replaceAppNotes } from "./cli-app-steps.mjs";

const toSnakeCase = (recipeSlug) => recipeSlug.replaceAll("-", "_");

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
      "go.mod": "module app\n\ngo 1.22\n",
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
};
