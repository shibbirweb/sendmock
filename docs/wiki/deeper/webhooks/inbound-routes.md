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

### 3. What happens to incoming emails, such as replies to mail your app sent: matching routes run in priority order until one stops, like Mailgun Routes.

Text.

- **What it does:** Explains the screen.
- **Same action elsewhere:** REST [`GET /api/v1/inbound-routes`](/api/inbound-routes/#getInboundRoutes), CLI [`sendmock route list`](/cli/inbound-routes/#route-list), MCP [`sendmock_inbound_route_list`](/mcp/inbound-routes/#sendmock_inbound_route_list)

### 4. Add route

Button.

- **What it does:** Opens the route editor; in it, adds the route.
- **Same action elsewhere:** REST [`POST /api/v1/inbound-routes`](/api/inbound-routes/#postInboundRoutes), CLI [`sendmock route create`](/cli/inbound-routes/#route-create), MCP [`sendmock_inbound_route_create`](/mcp/inbound-routes/#sendmock_inbound_route_create)

### 5. Priority

Column.

- **What it does:** The route's priority; lower runs first.

### 6. Route

Column.

- **What it does:** Its expression and actions, in Mailgun's syntax.

### 7. Actions

Column.

- **What it does:** Move, Edit and Delete.

### 8. Move … up

Button, in each row.

- **What it does:** Runs the route earlier.
- **Same action elsewhere:** REST [`PATCH /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#patchInboundRoutesByRouteId), CLI [`sendmock route update`](/cli/inbound-routes/#route-update), MCP [`sendmock_inbound_route_update`](/mcp/inbound-routes/#sendmock_inbound_route_update)

### 9. Move … down

Button, in each row.

- **What it does:** Runs the route later.
- **Same action elsewhere:** REST [`PATCH /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#patchInboundRoutesByRouteId), CLI [`sendmock route update`](/cli/inbound-routes/#route-update), MCP [`sendmock_inbound_route_update`](/mcp/inbound-routes/#sendmock_inbound_route_update)

### 10. Edit …

Button, in each row.

- **What it does:** Opens the route's editor.

### 11. Delete …

Button, in each row.

- **What it does:** Deletes the route after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#deleteInboundRoutesByRouteId), CLI [`sendmock route delete`](/cli/inbound-routes/#route-delete), MCP [`sendmock_inbound_route_delete`](/mcp/inbound-routes/#sendmock_inbound_route_delete)

## New route editor

### 12. Add route

Heading.

- **What it does:** The new route editor.

### 13. Which incoming emails it takes, and what it does with them, in Mailgun's route syntax.

Text.

- **What it does:** Explains the editor.

### 14. Priority

Field.

- **What it does:** When the route runs among the others.

### 15. Lower runs first.

Text.

- **What it does:** Explains the priority.

### 16. Description

Field.

- **What it does:** A note on what the route is for.

### 17. Match recipient A regex on each recipient address.

Choice.

- **What it does:** The route takes emails whose recipient matches the pattern (`match_recipient`).

### 18. Match header A regex on a header, e.g. subject.

Choice.

- **What it does:** The route takes emails whose header matches the pattern (`match_header`).

### 19. Catch all Every incoming email.

Choice.

- **What it does:** The route takes every incoming email (`catch_all`).

### 20. Pattern

Field.

- **What it does:** The regular expression to match.

### 21. A Python-style regex matched from the start; (?P\<token>...) captures a group for \\g\<token> in actions.

Text.

- **What it does:** Explains the pattern: a named group can be used in the actions.
- **Links to:** [Advanced: inbound routes](../../advanced/inbound-routes.md).

### 22. match_recipient("")

Text.

- **What it does:** The expression as Mailgun would show it, while the pattern is empty.

### 23. Actions

Heading.

- **What it does:** What the route does with a matching email.

### 24. Run in this order; URLs and addresses can use captured groups such as \\g\<token> .

Text.

- **What it does:** Explains the actions: forward to a URL or an address, store, or stop.

### 25. Add action

Button.

- **What it does:** Adds an action.

### 26. Move Action #: Forward to URL up

Button.

- **What it does:** Runs the action earlier.

### 27. Move Action #: Forward to URL down

Button.

- **What it does:** Runs the action later.

### 28. Remove Action #: Forward to URL

Button.

- **What it does:** Removes the action.

### 29. Action #: Forward to URL target

Field.

- **What it does:** Where the action forwards the email: a URL gets Mailgun's multipart fields, signed.

### 30. Fix the pattern to see which emails match.

Text.

- **What it does:** Shown while the pattern is not valid.

### 31. Cancel

Button.

- **What it does:** Closes the editor without saving.

### 32. Add route

Button.

- **What it does:** Adds the route; it takes the next incoming email.
- **Same action elsewhere:** REST [`POST /api/v1/inbound-routes`](/api/inbound-routes/#postInboundRoutes), CLI [`sendmock route create`](/cli/inbound-routes/#route-create), MCP [`sendmock_inbound_route_create`](/mcp/inbound-routes/#sendmock_inbound_route_create)

### 33. Close

Button.

- **What it does:** Closes the editor without saving.

## Route editor

### 34. Edit route

Heading.

- **What it does:** The editor of an existing route.

### 35. Which incoming emails it takes, and what it does with them, in Mailgun's route syntax.

Text.

- **What it does:** Explains the editor.

### 36. Priority

Field.

- **What it does:** When the route runs among the others.

### 37. Lower runs first.

Text.

- **What it does:** Explains the priority.

### 38. Description

Field.

- **What it does:** A note on what the route is for.

### 39. Match recipient A regex on each recipient address.

Choice.

- **What it does:** The route takes emails whose recipient matches the pattern (`match_recipient`).

### 40. Match header A regex on a header, e.g. subject.

Choice.

- **What it does:** The route takes emails whose header matches the pattern (`match_header`).

### 41. Catch all Every incoming email.

Choice.

- **What it does:** The route takes every incoming email (`catch_all`).

### 42. Pattern

Field.

- **What it does:** The regular expression to match.

### 43. A Python-style regex matched from the start; (?P\<token>...) captures a group for \\g\<token> in actions.

Text.

- **What it does:** Explains the pattern: a named group can be used in the actions.
- **Links to:** [Advanced: inbound routes](../../advanced/inbound-routes.md).

### 44. match_recipient("reply\\+(?P\<token>[\\w-]+)@reply\\.app\\.test")

Text.

- **What it does:** The expression as Mailgun would show it (here the demo's reply route).

### 45. Actions

Heading.

- **What it does:** What the route does with a matching email.

### 46. Run in this order; URLs and addresses can use captured groups such as \\g\<token> .

Text.

- **What it does:** Explains the actions: forward to a URL or an address, store, or stop.

### 47. Add action

Button.

- **What it does:** Adds an action.

### 48. Move Action #: … up

Button, in each row.

- **What it does:** Runs that action earlier.

### 49. Move Action #: … down

Button, in each row.

- **What it does:** Runs that action later.

### 50. Remove Action #: …

Button, in each row.

- **What it does:** Removes that action.

### 51. Action #: Forward to URL target

Field, in each row.

- **What it does:** Where that action forwards the email.

### 52. Matches # of the last # incoming emails

Text.

- **What it does:** How many recent incoming emails the route would take.
- **Same action elsewhere:** REST [`POST /api/v1/inbound-routes/test`](/api/inbound-routes/#postInboundRoutesTest), CLI [`sendmock route test`](/cli/inbound-routes/#route-test), MCP [`sendmock_inbound_route_test`](/mcp/inbound-routes/#sendmock_inbound_route_test)

### 53. Cancel

Button.

- **What it does:** Closes the editor without saving.

### 54. Save route

Button.

- **What it does:** Saves the route.
- **Same action elsewhere:** REST [`PATCH /api/v1/inbound-routes/{routeId}`](/api/inbound-routes/#patchInboundRoutesByRouteId), CLI [`sendmock route update`](/cli/inbound-routes/#route-update), MCP [`sendmock_inbound_route_update`](/mcp/inbound-routes/#sendmock_inbound_route_update)

### 55. Close

Button.

- **What it does:** Closes the editor without saving.

## When the data cannot load

### 56. Could not load the inbound routes. Try again

Message.

- **What it does:** Shown when the routes could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 57. Could not load the inbound routes.

Text.

- **What it does:** The message inside the alert.

### 58. Try again

Button.

- **What it does:** Loads the routes again.
- **Same action elsewhere:** REST [`GET /api/v1/inbound-routes`](/api/inbound-routes/#getInboundRoutes), CLI [`sendmock route list`](/cli/inbound-routes/#route-list), MCP [`sendmock_inbound_route_list`](/mcp/inbound-routes/#sendmock_inbound_route_list)
