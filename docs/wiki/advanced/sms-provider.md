---
title: Create an SMS provider
description: Answer an SMS API SendMock does not ship, such as a regional vendor, from its docs to a working provider, step by step.
---

> The screen works today in the [demo](/demo/sms/providers); requests to a custom provider's API are answered from Phase 4.

SendMock ships Twilio, Twilio Verify, Vonage, Plivo and MessageBird. Regional vendors are added without code, because a provider is a definition: the requests it answers, where each part of the message is read from, what it answers and its error codes. The demo already has one added this way: **SSL Wireless**.

This walkthrough adds **Africa's Talking**, whose send API is `POST /version1/messaging` with a form body. Swap in your vendor's names and fields as you go.

> The field names below (`to`, `message`, `SMSMessageData`, ...) come from Africa's Talking's API docs. Use the ones in your vendor's docs.

## Before you start: read the vendor's docs for

1. **The send request:** method, path and body format.
2. **Where each part is:** sender id, recipient and text.
3. **The answers:** the success body (with the message id your app reads) and the error body.
4. **The credentials** your app sends (username and API key).
5. **The status names and error codes** its delivery reports use.

## 1. Add the provider

1. Open **SMS > Providers** and press **Add provider**.
2. Set **Name** to `Africa's Talking`; the **Key** becomes `africa_s_talking`. Change it to `africastalking`, leave **Start from** on **Blank** and press **Add provider**. The provider sheet opens.

## 2. General

1. Set **Host** to `api.africastalking.com`.
2. Press **Add credential** twice: `username`, and `api_key` marked **Secret**.

## 3. Requests

1. Change **Request 1 path** to `/version1/messaging` and **Request 1 format** to **Form**.
2. Under **Field mapping**, press **Map a part** for each part and set its source:

   | Part | Source |
   | --- | --- |
   | to | `to` |
   | body | `message` |
   | from | `from` |

3. Under **Checks on a send**, press **Add check** twice: `to`, **Required**, **Missing field**; and `to`, **E.164 number**, **Invalid value**.

## 4. Responses

1. Set **Message id** to `ATXid_{{ random_hex(32) }}`.
2. Set the **Success response** status to `201` and its body to:

   ```json
   {"SMSMessageData": {"Message": "Sent to 1/1", "Recipients": [{"statusCode": 101, "number": "{{ message.to }}", "status": "Success", "messageId": "{{ message.provider_id }}"}]}}
   ```

## 5. Callbacks

Under **Status names**, set `delivered` to `Success` and `failed` to `Failed`, as its delivery reports name them. Under **Error codes**, set the codes it uses for each outcome, so the [test numbers](../sms/delivery-and-test-numbers.md) fail with its own codes.

## 6. Check the preview and save

1. Open **Preview**. The **Stored message** shows the sample recipient and text, and the **Response** is `201` with your body.
2. Press **Save provider**. Africa's Talking is listed as **Custom**.

## Related

- [SMS > Providers](../sms/providers.md)
- [Create an email provider](./email-provider.md)
- [SMS outcome numbers](./sms-outcome-numbers.md)
