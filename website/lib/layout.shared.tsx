import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { GithubStarBadge } from "@/components/github-star-badge";
import { SendMockLogo } from "@/components/sendmock-logo";
import { basePath } from "@/lib/base-path";
import { repositoryUrl } from "@/lib/community-links";

export { basePath };

/**
 * Navigation shared by the landing page and the docs. Every item is a link
 * item (not "custom"), so Fumadocs renders it inside a list item.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <SendMockLogo className="size-8" />
          <span className="font-semibold">SendMock</span>
        </>
      ),
    },
    links: [
      { text: "Docs", url: "/docs" },
      { text: "API", url: "/api" },
      { text: "Playground", url: "/playground" },
      // The demo is a separate app: an external link is a plain anchor, so
      // Next does not try to prefetch it as a route.
      { text: "Live demo", url: `${basePath}/demo/`, external: true },
      {
        type: "icon",
        label: "SendMock on GitHub",
        text: "GitHub",
        icon: <GithubStarBadge />,
        url: repositoryUrl,
        external: true,
      },
    ],
  };
}
