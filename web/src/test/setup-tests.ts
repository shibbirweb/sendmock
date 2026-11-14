import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up by itself when Vitest runs with globals, which
// this project does not, so each test would otherwise see the last one's DOM.
afterEach(() => {
  cleanup();
});
