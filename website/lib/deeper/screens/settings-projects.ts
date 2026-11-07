import type { DeeperEntry } from "../deeper-types";

/** Settings > Projects (PL-10). */
export const settingsProjectsEntries: DeeperEntry[] = [
  { control: "heading: Projects", does: "The projects that keep traffic apart.", operationIds: ["getProjects"] },
  {
    control: "paragraph: Keep apps' or developers' mail, SMS and codes apart in one SendMock. Settings, providers and webhooks are shared.",
    does: "Explains what a project holds and what every project shares.",
  },
  { control: "columnheader: Emails", does: "How many emails the project holds." },
  { control: "columnheader: Codes", does: "How many verifications the project holds." },
  { control: "columnheader: Actions", does: "Rename and Delete." },
  { control: "button: Rename Default", does: "Renames a project; its key stays the same, so apps keep sending to it.", operationIds: ["patchProjectsByProjectKey"] },
  { control: "button: New project", does: "Asks for a key and a name, then adds the project. The key is what apps send.", operationIds: ["postProjects"] },
  { control: "heading: Send to shop", does: "How an app sends to a project, shown for the first project after Default (or `shop` until one exists)." },
  {
    control: "paragraph: Traffic that names no project goes to Default. A project you have not created is refused, so a typo shows at once.",
    does: "Explains where traffic without a project goes, and that unknown projects are refused.",
  },
  { control: "button: Copy the SMTP username", does: "Copies the SMTP username that sends mail to the project." },
  { control: "button: Copy the header", does: "Copies the `X-SendMock-Project` header for the REST and provider APIs." },
  { control: "button: Copy the base URL", does: "Copies the provider port's base URL under `/projects/<key>/`, for SDKs that take a base URL." },
];
