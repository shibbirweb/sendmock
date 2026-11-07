import type { DeeperEntry, DeeperPage } from "../deeper-types";

function menuLink(
  title: string,
  shortcutKey: string,
  guidePage: string,
  subItems: string,
): DeeperEntry {
  return {
    control: `link: ${title}`,
    does: `Opens ${title}${subItems}. The keyboard shortcut is \`g\` then \`${shortcutKey}\`.`,
    source:
      "The sidebar is built from one list in the app, the same one the command palette and the shortcuts use, so the three never disagree.",
    links: `[${title}](../${guidePage}).`,
  };
}

/** The sidebar and the header: on every screen. */
export const appShellPage: DeeperPage = {
  screen: "shell",
  file: "app-shell.md",
  title: "Sidebar and header in depth",
  description:
    "Every control of the sidebar and the header, which every screen shares.",
  guidePage: "tour.md",
  guideTitle: "Tour of the app",
  intro:
    "The sidebar on the left and the header across the top are the same on every screen. The header also shows the open screen's name and a link to its guide page; those are listed on each screen's own Deeper page.",
  entries: [
    {
      control: "link: SendMock Mail · SMS · Payments",
      does: "Opens the Overview, the dashboard of everything SendMock caught today.",
      links: "[Overview](../overview.md).",
    },
    menuLink("Overview", "o", "overview.md", ""),
    menuLink(
      "Mail",
      "m",
      "mail/index.md",
      ", the inbox of every caught email; under it, Providers lists the email APIs SendMock answers",
    ),
    menuLink(
      "SMS",
      "s",
      "sms/index.md",
      ", the conversations of every SMS; under it are Verify (`g` then `v`) and Providers",
    ),
    menuLink(
      "HTTP Catcher",
      "h",
      "http/index.md",
      ", where bins capture the HTTP requests your app sends",
    ),
    menuLink(
      "Webhooks",
      "w",
      "webhooks/index.md",
      "; under it are Overview, Endpoints, Rules, Inbound routes, Deliveries (`g` then `d`), Composer, Templates, Variables and Saved",
    ),
    menuLink(
      "Payments",
      "p",
      "payments/index.md",
      "; under it are All payments, Gateways, Methods, Flows and Subscriptions",
    ),
    menuLink(
      "Numbers",
      "n",
      "numbers.md",
      ", the virtual phone numbers and their webhooks",
    ),
    menuLink(
      "Scenarios",
      "c",
      "scenarios.md",
      ", where multi-step checks are written and run",
    ),
    menuLink(
      "Logs",
      "l",
      "logs.md",
      ", the SMTP sessions and the provider API requests",
    ),
    menuLink("Settings", ",", "settings.md", ", every setting by section"),
    {
      control: "link: Documentation",
      does: "Opens the docs of the version you run, in a new tab.",
      source: "The docs address is built into the app.",
    },
    {
      control: "link: Report an issue",
      does: "Opens GitHub's bug report form in a new tab, filled in with your SendMock version, release channel, operating system and browser. Nothing else is sent, and nothing at all until you submit the form.",
      source:
        "The version and channel come from `GET /api/v1/info`; the system and browser from the browser itself.",
    },
    {
      control: "link: Request a feature",
      does: "Opens GitHub's feature request form in a new tab, filled in the same way as Report an issue.",
    },
    {
      control: "link: Report a security issue",
      does: "Opens GitHub's private security advisory form, so a vulnerability is not reported in public.",
    },
    {
      control: "link: Star on GitHub",
      does: "Opens the SendMock repository on GitHub in a new tab.",
    },
    {
      control: "status: Live · demo data, version #.#.#-dev",
      does: "Shows whether the app is connected to SendMock's realtime stream (Live, Connecting, or Offline, retrying), where the data comes from (the server, or demo data on the website demo) and the app's version.",
      source:
        "The connection state of the realtime stream, and the version the app was built with.",
      errors:
        "Offline, retrying means the realtime stream dropped: the app keeps trying, and screens still load when you open them. If it stays offline, check SendMock is still running.",
    },
    {
      control: "button: Toggle Sidebar",
      does: "Collapses the sidebar to icons, or opens it again. On a phone it opens the sidebar as a panel. The keyboard shortcut is `⌘` or `Ctrl` with `B`.",
      changes: "Remembered in the browser for your next visit.",
    },
    {
      control: "button: Search or jump to... ⌘K",
      does: "Opens the command palette: type a screen's name to go to it, or run one of its actions, Switch theme (`T`) and Show keyboard shortcuts (`?`). `⌘` or `Ctrl` with `K` opens it from anywhere.",
    },
    {
      control: "button: Demo controls",
      does: "Only on the website demo: opens the demo controls, which add sample traffic, slow down or fail the demo API, switch between the standard, large and empty data sets, and turn the live traffic every 12 seconds on or off.",
      changes:
        "Only the demo in your browser tab; reloading the page starts a fresh demo.",
    },
    {
      control: "button: Keyboard shortcuts",
      does: "Opens the list of keyboard shortcuts. `?` opens it too.",
    },
    {
      control: "button: Help",
      does: "Opens the Help menu: Documentation, Keyboard shortcuts, What's new, Report an issue, Request a feature, Report a security issue and Star on GitHub, the same links as the sidebar's.",
    },
    {
      control: "button: Change theme",
      does: "Opens a menu to pick System, Light or Dark. System follows your computer's setting. `T` switches to the next theme from anywhere.",
      changes: "Remembered in the browser for your next visit.",
    },
    {
      control: "button: Notifications",
      does: "Opens the list of recent notifications: new emails, new SMS and failed webhook deliveries, each opening what it is about. Clear all empties the list. When there are unread notifications the button says how many.",
      source:
        "Events from the realtime stream while the app is open; Settings > Notifications chooses which ones notify.",
      links:
        "The email, conversation or delivery each notification is about, and [Settings](../settings.md).",
    },
  ],
};
