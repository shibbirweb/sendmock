import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";

import { baseOptions } from "@/lib/layout.shared";
import { DemoBridgeProvider } from "@/lib/playground/demo-bridge-provider";

export default function PlaygroundLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <HomeLayout {...baseOptions()}>
      <DemoBridgeProvider>{children}</DemoBridgeProvider>
    </HomeLayout>
  );
}
