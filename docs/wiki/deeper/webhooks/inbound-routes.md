---
title: Inbound routes in depth
description: Every control and text of Webhooks > Inbound routes and the route editor.
---

> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.

Webhooks > Inbound routes decides what happens to incoming email, in Mailgun's route syntax.

The screen as a whole: [Inbound routes](../../webhooks/inbound-routes.md).

## On the screen

### 1. Inbound routes

Heading.

- **What it does:** Names the screen, in the header and above the list.

### 2. Read the Inbound routes guide

Link.

- **What it does:** Opens this screen's page in the user guide, in a new tab.
- **Links to:** [Inbound routes](../../webhooks/inbound-routes.md).

### 3. Inbound routes

Heading.

- **What it does:** Names the screen, in the header and above the list.

### 4. What happens to incoming emails, such as replies to mail your app sent: matching routes run in priority order until one stops, like Mailgun Routes.

Text.

- **What it does:** Explains the screen.
- **Same action elsewhere:** REST [`GET /api/v1/inbound-routes`](/api/inbound-routes/#getInboundRoutes), CLI [`sendmock route list`](/cli/inbound-routes/#route-list), MCP [`sendmock_inbound_route_list`](/mcp/inbound-routes/#sendmock_inbound_route_list)

### 5. Add route

Button.

- **What it does:** Opens the route editor; in it, adds the route.
- **Same action elsewhere:** REST [`POST /api/v1/inbound-routes`](/api/inbound-routes/#postInboundRoutes), CLI [`sendmock route create`](/cli/inbound-routes/#route-create), MCP [`sendmock_inbound_route_create`](/mcp/inbound-routes/#sendmock_inbound_route_create)

### 6. Priority

Column.

- **What it does:** The route's priority; lower runs first.

### 7. Route

Column.

- **What it does:** Its expression and actions, in Mailgun's syntax.

### 8. Actions

Column.

- **What it does:** Move, Edit and Delete.

### 9. Move … up

Button, in each row.

- **What it does:** Runs the route earlier.
- **Same action elsewhere:** REST [`PATCH /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#patchInboundRoutesByRouteId), CLI [`sendmock route update`](/cli/inbound-routes/#route-update), MCP [`sendmock_inbound_route_update`](/mcp/inbound-routes/#sendmock_inbound_route_update)

### 10. Move … down

Button, in each row.

- **What it does:** Runs the route later.
- **Same action elsewhere:** REST [`PATCH /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#patchInboundRoutesByRouteId), CLI [`sendmock route update`](/cli/inbound-routes/#route-update), MCP [`sendmock_inbound_route_update`](/mcp/inbound-routes/#sendmock_inbound_route_update)

### 11. Edit …

Button, in each row.

- **What it does:** Opens the route's editor.

### 12. Delete …

Button, in each row.

- **What it does:** Deletes the route after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#deleteInboundRoutesByRouteId), CLI [`sendmock route delete`](/cli/inbound-routes/#route-delete), MCP [`sendmock_inbound_route_delete`](/mcp/inbound-routes/#sendmock_inbound_route_delete)

## New route editor

### 13. Add route

Heading.

- **What it does:** The new route editor.

### 14. Which incoming emails it takes, and what it does with them, in Mailgun's route syntax.

Text.

- **What it does:** Explains the editor.

### 15. Priority

Field.

- **What it does:** When the route runs among the others.

### 16. Lower runs first.

Text.

- **What it does:** Explains the priority.

### 17. Description

Field.

- **What it does:** A note on what the route is for.

### 18. Match recipient A regex on each recipient address.

Choice.

- **What it does:** The route takes emails whose recipient matches the pattern (`match_recipient`).

### 19. Match header A regex on a header, e.g. subject.

Choice.

- **What it does:** The route takes emails whose header matches the pattern (`match_header`).

### 20. Catch all Every incoming email.

Choice.

- **What it does:** The route takes every incoming email (`catch_all`).

### 21. Pattern

Field.

- **What it does:** The regular expression to match.

### 22. A Python-style regex matched from the start; (?P\<token>...) captures a group for \\g\<token> in actions.

Text.

- **What it does:** Explains the pattern: a named group can be used in the actions.
- **Links to:** [Advanced: inbound routes](../../advanced/inbound-routes.md).

### 23. match_recipient("")

Text.

- **What it does:** The expression as Mailgun would show it, while the pattern is empty.

### 24. Actions

Heading.

- **What it does:** What the route does with a matching email.

### 25. Run in this order; URLs and addresses can use captured groups such as \\g\<token> .

Text.

- **What it does:** Explains the actions: forward to a URL or an address, store, or stop.

### 26. Add action

Button.

- **What it does:** Adds an action.

### 27. Move Action #: Forward to URL up

Button.

- **What it does:** Runs the action earlier.

### 28. Move Action #: Forward to URL down

Button.

- **What it does:** Runs the action later.

### 29. Remove Action #: Forward to URL

Button.

- **What it does:** Removes the action.

### 30. Action #: Forward to URL target

Field.

- **What it does:** Where the action forwards the email: a URL gets Mailgun's multipart fields, signed.

### 31. Fix the pattern to see which emails match.

Text.

- **What it does:** Shown while the pattern is not valid.

### 32. Cancel

Button.

- **What it does:** Closes the editor without saving.

### 33. Add route

Button.

- **What it does:** Adds the route; it takes the next incoming email.
- **Same action elsewhere:** REST [`POST /api/v1/inbound-routes`](/api/inbound-routes/#postInboundRoutes), CLI [`sendmock route create`](/cli/inbound-routes/#route-create), MCP [`sendmock_inbound_route_create`](/mcp/inbound-routes/#sendmock_inbound_route_create)

### 34. Close

Button.

- **What it does:** Closes the editor without saving.

## Route editor

### 35. Edit route

Heading.

- **What it does:** The editor of an existing route.

### 36. Which incoming emails it takes, and what it does with them, in Mailgun's route syntax.

Text.

- **What it does:** Explains the editor.

### 37. Priority

Field.

- **What it does:** When the route runs among the others.

### 38. Lower runs first.

Text.

- **What it does:** Explains the priority.

### 39. Description

Field.

- **What it does:** A note on what the route is for.

### 40. Match recipient A regex on each recipient address.

Choice.

- **What it does:** The route takes emails whose recipient matches the pattern (`match_recipient`).

### 41. Match header A regex on a header, e.g. subject.

Choice.

- **What it does:** The route takes emails whose header matches the pattern (`match_header`).

### 42. Catch all Every incoming email.

Choice.

- **What it does:** The route takes every incoming email (`catch_all`).

### 43. Pattern

Field.

- **What it does:** The regular expression to match.

### 44. A Python-style regex matched from the start; (?P\<token>...) captures a group for \\g\<token> in actions.

Text.

- **What it does:** Explains the pattern: a named group can be used in the actions.
- **Links to:** [Advanced: inbound routes](../../advanced/inbound-routes.md).

### 45. match_recipient("reply\\+(?P\<token>[\\w-]+)@reply\\.app\\.test")

Text.

- **What it does:** The expression as Mailgun would show it (here the demo's reply route).

### 46. Actions

Heading.

- **What it does:** What the route does with a matching email.

### 47. Run in this order; URLs and addresses can use captured groups such as \\g\<token> .

Text.

- **What it does:** Explains the actions: forward to a URL or an address, store, or stop.

### 48. Add action

Button.

- **What it does:** Adds an action.

### 49. Move Action #: … up

Button, in each row.

- **What it does:** Runs that action earlier.

### 50. Move Action #: … down

Button, in each row.

- **What it does:** Runs that action later.

### 51. Remove Action #: …

Button, in each row.

- **What it does:** Removes that action.

### 52. Action #: Forward to URL target

Field, in each row.

- **What it does:** Where that action forwards the email.

### 53. Matches # of the last # incoming emails

Text.

- **What it does:** How many recent incoming emails the route would take.
- **Same action elsewhere:** REST [`POST /api/v1/inbound-routes/test`](/api/inbound-routes/#postInboundRoutesTest), CLI [`sendmock route test`](/cli/inbound-routes/#route-test), MCP [`sendmock_inbound_route_test`](/mcp/inbound-routes/#sendmock_inbound_route_test)

### 54. Cancel

Button.

- **What it does:** Closes the editor without saving.

### 55. Save route

Button.

- **What it does:** Saves the route.
- **Same action elsewhere:** REST [`PATCH /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#patchInboundRoutesByRouteId), CLI [`sendmock route update`](/cli/inbound-routes/#route-update), MCP [`sendmock_inbound_route_update`](/mcp/inbound-routes/#sendmock_inbound_route_update)

### 56. Close

Button.

- **What it does:** Closes the editor without saving.

## When the data cannot load

### 57. Could not load the inbound routes. Try again

Message.

- **What it does:** Shown when the routes could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 58. Could not load the inbound routes.

Text.

- **What it does:** The message inside the alert.

### 59. Try again

Button.

- **What it does:** Loads the routes again.
- **Same action elsewhere:** REST [`GET /api/v1/inbound-routes`](/api/inbound-routes/#getInboundRoutes), CLI [`sendmock route list`](/cli/inbound-routes/#route-list), MCP [`sendmock_inbound_route_list`](/mcp/inbound-routes/#sendmock_inbound_route_list)
