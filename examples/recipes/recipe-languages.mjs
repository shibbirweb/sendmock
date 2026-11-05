// How each language's recipe examples are saved and run; a language is added here.
export const recipeLanguages = {
  javascript: {
    tabName: "JavaScript",
    helperPage: "connect/node.md",
    helperFilePath: (helperFileName) => helperFileName,
    recipeFilePath: (recipeSlug) => `${recipeSlug}.test.js`,
    buildCommand: (recipeFilePath) => [
      "node_modules/.bin/vitest",
      ["run", recipeFilePath, "--testTimeout=30000"],
    ],
  },
};
