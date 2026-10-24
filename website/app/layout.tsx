import "./global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { basePath } from "@/lib/layout.shared";

export const metadata: Metadata = {
  title: {
    default: "MessageHook: local sandbox for email, SMS, payments and webhooks",
    template: "%s | MessageHook",
  },
  description:
    "A single binary that catches email, SMS and payments from any app, shows them in a web UI and calls your webhooks.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          search={{
            // Static export: the index is prebuilt by app/api/search/route.ts.
            // TODO(U3): replace the deprecated "static" option with a custom Orama dialog.
            options: { type: "static", api: `${basePath}/api/search` },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
