import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "@/app/app";
import { apiMode } from "@/config/api-mode";

async function startApp() {
  if (apiMode === "mock") {
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
