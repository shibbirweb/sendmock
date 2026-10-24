import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { DemoLink } from "@/components/demo-link";
import { SendMockLogo } from "@/components/sendmock-logo";

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Navigation shared by the landing page and the docs. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <SendMockLogo className="size-6" />
          <span className="font-semibold">SendMock</span>
        </>
      ),
    },
    links: [
      { text: "Docs", url: "/docs" },
      {
        type: "custom",
        children: (
          <DemoLink className="text-sm text-fd-muted-foreground hover:text-fd-foreground">
            Live demo
          </DemoLink>
        ),
      },
    ],
  };
}
