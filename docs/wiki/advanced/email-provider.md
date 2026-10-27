---
title: Create an email provider
description: Answer an email API SendMock does not ship, from its docs to a working provider, step by step.
---

> The screen works today in the [demo](/demo/mail/providers); requests to a custom provider's API are answered from Phase 4.

SendMock ships SendGrid, Mailgun, Postmark, Resend, Amazon SES and Brevo. Any other email API can be added without code, because a provider is a definition: the requests it answers, where each part of the email is read from, and what it answers.

This walkthrough adds **Mailjet**, whose send API is `POST /v3.1/send` with a JSON body. Swap in your provider's names and fields as you go.

> The field names below (`Messages`, `TextPart`, `MessageID`, ...) come from Mailjet's API docs. Use the ones in your provider's docs.

## Before you start: read the provider's docs for

1. **The send request:** method, path and body format (JSON, form or multipart).
2. **Where each part is:** sender, recipients, subject, text and HTML.
3. **The answers:** the success body (with the message id your app reads) and the error body.
4. **The credentials** your app sends (API key and secret).

## 1. Add the provider

1. Open **Mail > Providers** and press **Add provider**.
2. Set **Name** to `Mailjet`; the **Key** becomes `mailjet`. Leave **Start from** on **Blank** and press **Add provider**. The provider sheet opens.

## 2. General

1. Set **Host** to `api.mailjet.com`.
2. Press **Add credential** twice: `api_key`, and `secret_key` marked **Secret**.

## 3. Requests

1. Change **Request 1 path** to `/v3.1/send`. Keep **POST** and **JSON**.
2. Under **Field mapping**, press **Map a part** for each part and set its source:

   | Part | Source |
   | --- | --- |
   | from | `Messages[0].From.Email` |
   | to | `Messages[0].To[*].Email` |
   | subject | `Messages[0].Subject` |
   | text | `Messages[0].TextPart` |
   | html | `Messages[0].HTMLPart` |

3. Under **Checks on a send**, press **Add check**: `to`, **Required**, **Missing field**.

## 4. Responses

1. Set **Message id** to `{{ random_hex(16) }}`.
2. Set the **Success response** body to:

   ```json
   {"Messages": [{"Status": "success", "To": [{"Email": "{{ message.to }}", "MessageID": "{{ message.provider_id }}"}]}]}
   ```

3. Press **Add an error response** and set its body to:

   ```json
   {"ErrorMessage": "{{ error.reason }}", "StatusCode": 400}
   ```

## 5. Check the preview

Open **Preview**. The sample send is built from your field mapping: the **Stored message** shows `ana@example.test` as recipient, and the **Response** is `200` with your body. Clear the sample body to `{}` and the answer becomes your error response.

## 6. Save and connect your app

1. Press **Save provider**. Mailjet is listed as **Custom**.
2. Open **Try it** and point Mailjet's SDK at the base URL it shows.

To share it with your team, export the seed file in [Settings > Seed](../settings.md#seed): custom providers are saved with their secrets as `${ENV}` references.

## Related

- [Mail > Providers](../mail/providers.md)
- [Create an SMS provider](./sms-provider.md)
- [Create a payment gateway](./payment-gateway.md)
