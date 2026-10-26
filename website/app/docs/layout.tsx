import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { BugIcon, LightbulbIcon, ShieldAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  bugReportUrl,
  featureRequestUrl,
  repositoryUrl,
  securityReportUrl,
} from "@/lib/community-links";
import { IconWithTooltip } from "@/components/docs/icon-with-tooltip";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

/** Small sidebar icons; `!` beats the link's own `[&_svg]:size-4.5`. */
const sidebarIconClassName = "size-3.5!";

/**
 * GitHub and the feedback forms as icons in the docs sidebar footer. GitHub is
 * an icon here instead of the header's "GitHub" and star count, to save space.
 */
const sidebarIconLinks: LinkItemType[] = [
  {
    type: "icon",
    label: "Star SendMock on GitHub",
    text: "GitHub",
    icon: (
      <IconWithTooltip label="Star the repo" align="start">
        <GitHubLogoIcon className={sidebarIconClassName} />
      </IconWithTooltip>
    ),
    url: repositoryUrl,
    external: true,
  },
  {
    type: "icon",
    label: "Request a feature",
    text: "Request a feature",
    icon: (
      <IconWithTooltip label="Request a feature">
        <LightbulbIcon className={sidebarIconClassName} />
      </IconWithTooltip>
    ),
    url: featureRequestUrl,
    external: true,
  },
  {
    type: "icon",
    label: "Report a bug",
    text: "Report a bug",
    icon: (
      <IconWithTooltip label="Report a bug">
        <BugIcon className={sidebarIconClassName} />
      </IconWithTooltip>
    ),
    url: bugReportUrl,
    external: true,
  },
  {
    type: "icon",
    label: "Report a security issue",
    text: "Report a security issue",
    icon: (
      <IconWithTooltip label="Report a security issue">
        <ShieldAlertIcon className={sidebarIconClassName} />
      </IconWithTooltip>
    ),
    url: securityReportUrl,
    external: true,
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const sharedOptions = baseOptions();

  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...sharedOptions}
      links={[
        ...(sharedOptions.links ?? []).filter(
          (linkItem) => !("url" in linkItem && linkItem.url === repositoryUrl),
        ),
        ...sidebarIconLinks,
      ]}
    >
      {children}
    </DocsLayout>
  );
}
