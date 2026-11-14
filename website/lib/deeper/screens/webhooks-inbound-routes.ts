import type { DeeperEntry, DeeperPage } from "../deeper-types";

const routeListEntries: DeeperEntry[] = [
  {
    control: "heading: Inbound routes",
    does: "Names the screen, in the header and above the list.",
  },
  {
    control: "link: Read the Inbound routes guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Inbound routes](../../webhooks/inbound-routes.md).",
  },
  {
    control:
      "paragraph: What happens to incoming emails, such as replies to mail your app sent: matching routes run in priority order until one stops, like Mailgun Routes.",
    does: "Explains the screen.",
    operationIds: ["getInboundRoutes"],
  },
  {
    control: "button: Add route",
    does: "Opens the route editor; in it, adds the route.",
    operationIds: ["postInboundRoutes"],
  },
  {
    control: "columnheader: Priority",
    does: "The route's priority; lower runs first.",
  },
  {
    control: "columnheader: Route",
    does: "Its expression and actions, in Mailgun's syntax.",
  },
  { control: "columnheader: Actions", does: "Move, Edit and Delete." },
  {
    control: "each item, button: Move … up",
    does: "Runs the route earlier.",
    operationIds: ["patchInboundRoutesByRouteId"],
  },
  {
    control: "each item, button: Move … down",
    does: "Runs the route later.",
    operationIds: ["patchInboundRoutesByRouteId"],
  },
  { control: "each item, button: Edit …", does: "Opens the route's editor." },
  {
    control: "each item, button: Delete …",
    does: "Deletes the route after you confirm.",
    operationIds: ["deleteInboundRoutesByRouteId"],
  },
  {
    control: "alert: Could not load the inbound routes. Try again",
    does: "Shown when the routes could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load the inbound routes.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the routes again.",
    operationIds: ["getInboundRoutes"],
  },
];

const routeEditorEntries: DeeperEntry[] = [
  { control: "heading: Add route", does: "The new route editor." },
  { control: "heading: Edit route", does: "The editor of an existing route." },
  {
    control:
      "paragraph: Which incoming emails it takes, and what it does with them, in Mailgun's route syntax.",
    does: "Explains the editor.",
  },
  {
    control: "textbox: Priority",
    does: "When the route runs among the others.",
  },
  { control: "paragraph: Lower runs first.", does: "Explains the priority." },
  { control: "textbox: Description", does: "A note on what the route is for." },
  {
    control: "radio: Match recipient A regex on each recipient address.",
    does: "The route takes emails whose recipient matches the pattern (`match_recipient`).",
  },
  {
    control: "radio: Match header A regex on a header, e.g. subject.",
    does: "The route takes emails whose header matches the pattern (`match_header`).",
  },
  {
    control: "radio: Catch all Every incoming email.",
    does: "The route takes every incoming email (`catch_all`).",
  },
  { control: "textbox: Pattern", does: "The regular expression to match." },
  {
    control:
      "paragraph: A Python-style regex matched from the start; (?P<token>...) captures a group for \\g<token> in actions.",
    does: "Explains the pattern: a named group can be used in the actions.",
    links: "[Advanced: inbound routes](../../advanced/inbound-routes.md).",
  },
  {
    control: 'paragraph: match_recipient("")',
    does: "The expression as Mailgun would show it, while the pattern is empty.",
  },
  {
    control:
      'paragraph: match_recipient("reply\\+(?P<token>[\\w-]+)@reply\\.app\\.test")',
    does: "The expression as Mailgun would show it (here the demo's reply route).",
  },
  {
    control: "heading: Actions",
    does: "What the route does with a matching email.",
  },
  {
    control:
      "paragraph: Run in this order; URLs and addresses can use captured groups such as \\g<token> .",
    does: "Explains the actions: forward to a URL or an address, store, or stop.",
  },
  { control: "button: Add action", does: "Adds an action." },
  {
    control: "button: Move Action #: Forward to URL up",
    does: "Runs the action earlier.",
  },
  {
    control: "button: Move Action #: Forward to URL down",
    does: "Runs the action later.",
  },
  {
    control: "button: Remove Action #: Forward to URL",
    does: "Removes the action.",
  },
  {
    control: "textbox: Action #: Forward to URL target",
    does: "Where the action forwards the email: a URL gets Mailgun's multipart fields, signed.",
  },
  {
    control: "each item, button: Move Action #: … up",
    does: "Runs that action earlier.",
  },
  {
    control: "each item, button: Move Action #: … down",
    does: "Runs that action later.",
  },
  {
    control: "each item, button: Remove Action #: …",
    does: "Removes that action.",
  },
  {
    control: "each item, textbox: Action #: Forward to URL target",
    does: "Where that action forwards the email.",
  },
  {
    control: "paragraph: Fix the pattern to see which emails match.",
    does: "Shown while the pattern is not valid.",
  },
  {
    control: "paragraph: Matches # of the last # incoming emails",
    does: "How many recent incoming emails the route would take.",
    operationIds: ["postInboundRoutesTest"],
  },
  { control: "button: Cancel", does: "Closes the editor without saving." },
  {
    control: "button: Add route",
    state: "New route editor",
    does: "Adds the route; it takes the next incoming email.",
    operationIds: ["postInboundRoutes"],
  },
  {
    control: "button: Save route",
    does: "Saves the route.",
    operationIds: ["patchInboundRoutesByRouteId"],
  },
  { control: "button: Close", does: "Closes the editor without saving." },
];

/** Webhooks > Inbound routes: Mailgun-style routes for incoming email. */
export const webhooksInboundRoutesPage: DeeperPage = {
  screen: "/webhooks/inbound-routes",
  file: "webhooks/inbound-routes.md",
  title: "Inbound routes in depth",
  description:
    "Every control and text of Webhooks > Inbound routes and the route editor.",
  guidePage: "webhooks/inbound-routes.md",
  guideTitle: "Inbound routes",
  intro:
    "Webhooks > Inbound routes decides what happens to incoming email, in Mailgun's route syntax.",
  entries: [...routeListEntries, ...routeEditorEntries],
};
