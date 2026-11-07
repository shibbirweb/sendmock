/** One control or text of a screen, in the plain words of its Deeper page (WS-10.2). */
export type DeeperEntry = {
  /** The control as the inventory names it, such as `button: Delete all emails`. */
  control: string;
  /** What it does, step by step, and what you see afterwards. */
  does: string;
  /** What it changes or sends: stored data, events, webhooks, log entries. */
  changes?: string;
  /** Where its text and numbers come from: a setting, a seed key, an API field. */
  source?: string;
  /** The other screens it opens or relates to. */
  links?: string;
  /** The errors it can show, why, and what to do. */
  errors?: string;
  /** The operations it runs; their REST call, CLI command and MCP tool are generated. */
  operationIds?: string[];
};

/** A Deeper page: every control and text of one screen of the app. */
export type DeeperPage = {
  /** The inventory screen: its path, or `shell` for the sidebar and header. */
  screen: string;
  /** Path under `docs/wiki/deeper/`, such as `mail/inbox.md`. */
  file: string;
  title: string;
  description: string;
  /** The guide page for the same screen, relative to `docs/wiki/`, and its title. */
  guidePage: string;
  guideTitle: string;
  /** A sentence or two on what the screen is for. */
  intro: string;
  entries: DeeperEntry[];
};

/** A data state of a screen, as the crawl reads it from the demo. */
export type DeeperState = "normal" | "empty" | "failing";
