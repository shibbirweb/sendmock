---
title: Verify in depth
description: Every control and text of SMS > Verify, a verification's details and the services.
---

> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.

SMS > Verify shows every one-time code your app requested through the Twilio Verify API, and lets you force any outcome.

The screen as a whole: [Verify](../../sms/verify.md).

## On the screen

### 1. Verify

Heading.

- **What it does:** Names the screen, in the header and above the tabs.

### 2. Read the Verify guide

Link.

- **What it does:** Opens this screen's page in the user guide, in a new tab.
- **Links to:** [Verify](../../sms/verify.md).

### 3. Verify

Heading.

- **What it does:** Names the screen, in the header and above the tabs.

### 4. Twilio Verify emulation: every code your app requests, its attempts and expiry, and controls to force any outcome.

Text.

- **What it does:** Explains the screen.

### 5. Verifications

Tab.

- **What it does:** Every verification your app started, newest first.
- **Same action elsewhere:** REST [`GET /api/v1/verify`](/api/verify/#getVerify), CLI [`sendmock verify list`](/cli/verify/#verify-list), MCP [`sendmock_verify_list`](/mcp/verify/#sendmock_verify_list)

### 6. Services

Tab.

- **What it does:** The Verify services apps start verifications against.
- **Same action elsewhere:** REST [`GET /api/v1/verify/services`](/api/verify/#getVerifyServices), CLI [`sendmock verify services list`](/cli/verify/#verify-services-list), MCP [`sendmock_verify_service_list`](/mcp/verify/#sendmock_verify_service_list)

### 7. All

Button.

- **What it does:** Shows every verification.

### 8. Pending

Button.

- **What it does:** Shows only verifications still waiting for a correct code.

### 9. Approved

Button.

- **What it does:** Shows only approved verifications.

### 10. Failed

Button.

- **What it does:** Shows only verifications that expired, were cancelled or ran out of attempts.

### 11. Search verifications

Field.

- **What it does:** Filters by phone number, email address or service.

### 12. To

Column.

- **What it does:** Who the code went to.

### 13. Channel

Column.

- **What it does:** SMS, WhatsApp, email or call.

### 14. Service

Column.

- **What it does:** The Verify service it belongs to.

### 15. Code

Column.

- **What it does:** The code that was sent.

### 16. Status

Column.

- **What it does:** Pending, approved, canceled, expired or max attempts reached.

### 17. Attempts

Column.

- **What it does:** How many checks were made, against the service's limit.

### 18. Time

Column.

- **What it does:** When it was started.

### 19. …

Link, in each row.

- **What it does:** Opens the verification's details.
- **Same action elsewhere:** REST [`GET /api/v1/verify/{verificationSid}`](/api/verify/#getVerifyByVerificationSid), CLI [`sendmock verify show`](/cli/verify/#verify-show), MCP [`sendmock_verify_get`](/mcp/verify/#sendmock_verify_get)

### 20. Copy code #

Button, in each row.

- **What it does:** Copies the code, to type it into your app.

## A verification is open

### 21. Verification

Heading.

- **What it does:** The details drawer of one verification.

### 22. Code, attempts and everything that happened to it.

Text.

- **What it does:** Explains the drawer: the code, each check with its result, and the timeline.

### 23. Copy code

Button.

- **What it does:** Copies the code.

### 24. Open the message

Link.

- **What it does:** Opens the SMS or email the code was delivered in.
- **Links to:** [SMS](../../sms/index.md).

### 25. Force a state

Heading.

- **What it does:** Moves the verification to a final state by hand, to test what your app does then.

### 26. Approve

Button.

- **What it does:** Approves the verification, as a correct code would.
- **What it changes:** Fires `verify.checked` with the status `approved`.
- **Same action elsewhere:** REST [`POST /api/v1/verify/{verificationSid}/force`](/api/verify/#postVerifyByVerificationSidForce), CLI [`sendmock verify force`](/cli/verify/#verify-force), MCP [`sendmock_verify_force`](/mcp/verify/#sendmock_verify_force)

### 27. Cancel

Button.

- **What it does:** In the drawer, cancels the verification (fires `verify.checked` with the status `canceled`); in a dialog, closes it without saving.
- **Same action elsewhere:** REST [`POST /api/v1/verify/{verificationSid}/force`](/api/verify/#postVerifyByVerificationSidForce), CLI [`sendmock verify force`](/cli/verify/#verify-force), MCP [`sendmock_verify_force`](/mcp/verify/#sendmock_verify_force)

### 28. Expire

Button.

- **What it does:** Expires the verification, as when its time runs out.
- **What it changes:** Fires `verify.expired`.
- **Same action elsewhere:** REST [`POST /api/v1/verify/{verificationSid}/force`](/api/verify/#postVerifyByVerificationSidForce), CLI [`sendmock verify force`](/cli/verify/#verify-force), MCP [`sendmock_verify_force`](/mcp/verify/#sendmock_verify_force)

### 29. Max attempts

Button.

- **What it does:** Ends the verification as if too many wrong codes were tried; checks then get Twilio's 60202 error.
- **What it changes:** Fires `verify.checked` with the status `max_attempts_reached`.
- **Same action elsewhere:** REST [`POST /api/v1/verify/{verificationSid}/force`](/api/verify/#postVerifyByVerificationSidForce), CLI [`sendmock verify force`](/cli/verify/#verify-force), MCP [`sendmock_verify_force`](/mcp/verify/#sendmock_verify_force)

### 30. Your app sees the new state on its next check or fetch.

Text.

- **What it does:** Explains when the forced state takes effect.

### 31. Close

Button.

- **What it does:** Closes the drawer or dialog.

## Services tab

### 32. Code length, an optional fixed code and how long codes stay valid.

Text.

- **What it does:** Explains what a service sets.

### 33. New service

Button.

- **What it does:** Opens the New Verify service dialog.

### 34. Name

Column.

- **What it does:** The service's friendly name.

### 35. SID

Column.

- **What it does:** Its `VA...` SID, which apps put in the Verify API path.

### 36. Expires after

Column.

- **What it does:** How long a code stays valid.

### 37. Actions

Column.

- **What it does:** Edit and Delete for each service.

### 38. …

Button, in each row.

- **What it does:** Edit opens the service's settings; Delete removes it after you confirm.
- **Same action elsewhere:** REST [`PATCH /api/v1/verify/services/{serviceSid}`](/api/verify/#patchVerifyServicesByServiceSid), CLI [`sendmock verify services update`](/cli/verify/#verify-services-update), MCP [`sendmock_verify_service_update`](/mcp/verify/#sendmock_verify_service_update)
- **Same action elsewhere:** REST [`DELETE /api/v1/verify/services/{serviceSid}`](/api/verify/#deleteVerifyServicesByServiceSid), CLI [`sendmock verify services delete`](/cli/verify/#verify-services-delete), MCP [`sendmock_verify_service_delete`](/mcp/verify/#sendmock_verify_service_delete)

## New Verify service dialog

### 39. New Verify service

Heading.

- **What it does:** The New Verify service dialog.

### 40. Apps start verifications against a service by its SID.

Text.

- **What it does:** Explains the SID.

### 41. Name

Field.

- **What it does:** The service's friendly name.

### 42. Code length

Drop-down.

- **What it does:** How many digits the codes have, 4 to 10.

### 43. Expires after (minutes)

Number field.

- **What it does:** How long a code stays valid.

### 44. Fixed code (optional)

Field.

- **What it does:** A code every verification of this service uses, instead of a random one.

### 45. Leave empty for a random code. A fixed code makes tests deterministic.

Text.

- **What it does:** Explains the fixed code.

### 46. Cancel

Button.

- **What it does:** In the drawer, cancels the verification (fires `verify.checked` with the status `canceled`); in a dialog, closes it without saving.
- **Same action elsewhere:** REST [`POST /api/v1/verify/{verificationSid}/force`](/api/verify/#postVerifyByVerificationSidForce), CLI [`sendmock verify force`](/cli/verify/#verify-force), MCP [`sendmock_verify_force`](/mcp/verify/#sendmock_verify_force)

### 47. Create service

Button.

- **What it does:** Creates the service with a new SID.
- **Same action elsewhere:** REST [`POST /api/v1/verify/services`](/api/verify/#postVerifyServices), CLI [`sendmock verify services create`](/cli/verify/#verify-services-create), MCP [`sendmock_verify_service_create`](/mcp/verify/#sendmock_verify_service_create)

### 48. Close

Button.

- **What it does:** Closes the drawer or dialog.

## With no data yet

### 49. No verifications yet

Text.

- **What it does:** Shown when no verification was started yet.

### 50. Start one from your app with the Twilio Verify API. The code shows up here and in the SMS screen.

Text.

- **What it does:** Explains how verifications arrive.

### 51. This machine

Choice.

- **What it does:** Shows the addresses for an app on the same machine.
- **What it changes:** Shared with Settings > Connection and remembered in the browser.
- **Same action elsewhere:** REST [`GET /api/v1/info`](/api/system/#getInfo), CLI [`sendmock status`](/cli/system/#status), MCP [`sendmock_status`](/mcp/system/#sendmock_status)

### 52. Docker host

Choice.

- **What it does:** Shows the addresses for an app in a container reaching SendMock on the host.

### 53. Compose

Choice.

- **What it does:** Shows the addresses for an app in the same Docker Compose project.

### 54. Copy Twilio base URL

Button.

- **What it does:** Copies the base URL to give Twilio's SDK.

### 55. Copy Start a verification

Button.

- **What it does:** Copies the Verify API URL that starts a verification.

### 56. More snippets

Link.

- **What it does:** Opens Settings > Connection.
- **Links to:** [Settings](../../settings.md).

### 57. Start a sample verification

Button.

- **What it does:** Starts a verification against the first service and delivers its code by SMS.
- **What it changes:** Fires `verify.started` and stores the SMS with the code.
- **Same action elsewhere:** REST [`POST /api/v1/samples/{kind}`](/api/system/#postSamplesByKind), CLI [`sendmock sample`](/cli/system/#sample), MCP [`sendmock_sample_send`](/mcp/system/#sendmock_sample_send)

## When the data cannot load

### 58. Could not load verifications. Try again

Message.

- **What it does:** Shown when the verifications could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 59. Could not load verifications.

Text.

- **What it does:** The message inside the alert.

### 60. Try again

Button.

- **What it does:** Loads the verifications again.
- **Same action elsewhere:** REST [`GET /api/v1/verify`](/api/verify/#getVerify), CLI [`sendmock verify list`](/cli/verify/#verify-list), MCP [`sendmock_verify_list`](/mcp/verify/#sendmock_verify_list)
