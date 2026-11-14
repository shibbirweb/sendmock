import {
  BookOpenIcon,
  BugIcon,
  KeyboardIcon,
  LightbulbIcon,
  type LucideIcon,
  NewspaperIcon,
  ShieldAlertIcon,
  StarIcon,
} from "lucide-react";

import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import {
  buildIssueFormUrl,
  changelogUrl,
  describeEnvironment,
  documentationUrl,
  repositoryUrl,
  securityReportUrl,
} from "@/lib/community/community-links";

export type CommunityLink = {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Opens in a new tab; null for the in-app keyboard shortcuts dialog. */
  href: string | null;
  hint?: string;
};

/** The Help menu and Settings > About links, with the issue forms pre-filled. */
export function useCommunityLinks(): CommunityLink[] {
  const appInfo = useAppInfo().data;
  const feedbackEnvironment = {
    version: appInfo?.version ?? "unknown",
    channel: appInfo?.channel ?? "unknown",
    ...describeEnvironment(navigator.userAgent),
  };

  return [
    {
      key: "docs",
      label: "Documentation",
      Icon: BookOpenIcon,
      href: documentationUrl,
    },
    {
      key: "shortcuts",
      label: "Keyboard shortcuts",
      Icon: KeyboardIcon,
      href: null,
    },
    {
      key: "changelog",
      label: "What's new",
      Icon: NewspaperIcon,
      href: changelogUrl,
    },
    {
      key: "bug",
      label: "Report an issue",
      Icon: BugIcon,
      href: buildIssueFormUrl("bug", feedbackEnvironment),
    },
    {
      key: "feature",
      label: "Request a feature",
      Icon: LightbulbIcon,
      href: buildIssueFormUrl("feature", feedbackEnvironment),
    },
    {
      key: "security",
      label: "Report a security issue",
      Icon: ShieldAlertIcon,
      href: securityReportUrl,
      hint: "Private; please do not open a public issue.",
    },
    {
      key: "star",
      label: "Star on GitHub",
      Icon: StarIcon,
      href: repositoryUrl,
    },
  ];
}
