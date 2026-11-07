---
title: Create an SMS provider
description: Answer an SMS API SendMock does not ship, such as a regional vendor, from its docs to a working provider, step by step.
---

> Try it in the [demo](/demo/sms/providers).

SendMock ships Twilio, Twilio Verify, Vonage, Plivo, MessageBird, Infobip, Telnyx, Sinch and Africa's Talking. Regional vendors are added without code, because a provider is a definition: the requests it answers, where each part of the message is read from, what it answers and its error codes. The demo already has one added this way: **SSL Wireless**.

This walkthrough adds **Clickatell**, whose send API is `POST /messages` with a JSON body. Swap in your vendor's names and fields as you go. A vendor path may not start with `/api/` or `/providers/`, which are SendMock's own.

> The field names below (`to`, `content`, `apiMessageId`, ...) come from Clickatell's API docs. Use the ones in your vendor's docs.

## Before you start: read the vendor's docs for

1. **The send request:** method, path and body format.
2. **Where each part is:** sender id, recipient and text.
3. **The answers:** the success body (with the message id your app reads) and the error body.
4. **The credentials** your app sends (here an API key in the `Authorization` header).
5. **The status names and error codes** its delivery reports use.

## 1. Add the provider

1. Open **SMS > Providers** and press **Add provider**.
2. Set **Name** to `Clickatell`; the **Key** becomes `clickatell`. Leave **Start from** on **Blank** and press **Add provider**. The provider sheet opens.

## 2. General

1. Set **Host** to `platform.clickatell.com`. MessageBird uses the same `/messages` path; on the provider port the host tells them apart.
2. Press **Add credential** and add `api_key`, marked **Secret**.

## 3. Requests

1. Change **Request 1 path** to `/messages`; **Request 1 format** stays **JSON**.
2. Under **Field mapping**, press **Map a part** for each part and set its source:

   | Part | Source |
   | --- | --- |
   | to | `to[*]` |
   | body | `content` |
   | from | `from` |

3. Under **Checks on a send**, press **Add check**: `to`, **Required**, **Missing field**. Clickatell takes numbers without the `+`, so no E.164 check.

## 4. Responses

1. Set **Message id** to `{{ random_hex(16) }}`.
2. Set the **Success response** status to `202` and its body to:

   ```json
   {"messages": [{"apiMessageId": "{{ message.provider_id }}", "accepted": true, "to": "{{ message.to }}", "error": null}], "error": null}
   ```

## 5. Callbacks

Under **Status names**, set `delivered` and `failed` to the names its delivery reports use. Under **Error codes**, set the codes it uses for each outcome, so the [test numbers](../sms/delivery-and-test-numbers.md) fail with its own codes.

## 6. Check the preview and save

1. Open **Preview**. The **Stored message** shows the sample recipient and text, and the **Response** is `202` with your body.
2. Press **Save provider**. Clickatell is listed as **Custom**.

## Related

- [SMS > Providers](../sms/providers.md)
- [Create an email provider](./email-provider.md)
- [SMS outcome numbers](./sms-outcome-numbers.md)
