import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "@/app/app";

async function startApp() {
  // Compared here, not through a shared constant, so a live build drops the
  // mock layer from the bundle instead of emitting it as an unused chunk.
  if (import.meta.env.VITE_API_MODE !== "live") {
    const { startMockApi } = await import("@/mocks/start-mock-api");
    await startMockApi();
  }

  const rootElement = document.getElementById("root");
  if (rootElement === null) {
    throw new Error("The #root element is missing from index.html");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp();
