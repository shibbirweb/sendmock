/** Ready-made scenarios for Load example; each runs in Demo mode as written. */
export const scenarioExamples = [
  {
    exampleKey: "otp-sms",
    title: "Read the code of an SMS",
    scenarioText: `name = "otp-from-sms"

# Your app would send this; here a sample stands in for it.
[[steps]]
run = "sample.send"
with = { kind = "sms" }
save = "sample"

[[steps]]
run = "sms.get"
with = { smsId = "{{ sample.id }}" }
save = "sms"

[[steps]]
run = "otp.get"
with = { to = "{{ sms.to_number }}", channel = "sms" }
save = "otp"

[[steps]]
run = "assert"
with = { that = "{{ otp.code | length }} == 6" }

[[steps]]
run = "sms.open"
with = { smsId = "{{ sample.id }}" }
`,
  },
  {
    exampleKey: "reply-by-email",
    title: "Reply to an email as its recipient",
    scenarioText: `name = "reply-by-email"

[[steps]]
run = "sample.send"
with = { kind = "email", to = "ticket@example.test", subject = "Ticket 42 updated" }
save = "sample"

[[steps]]
run = "email.reply"
with = { emailId = "{{ sample.id }}", body = "Thanks, that fixed it." }
save = "reply"

[[steps]]
run = "email.timeline"
with = { emailId = "{{ sample.id }}" }
`,
  },
  {
    exampleKey: "checkout",
    title: "Pay a Stripe checkout with a test card",
    scenarioText: `name = "stripe-checkout"

[[steps]]
run = "payment.create.checkout"
with = { provider = "stripe", amount_minor = 1500, currency = "USD" }
save = "payment"

[[steps]]
run = "checkout.complete"
with = { sessionId = "{{ payment.id }}", action = "pay", method_key = "card", card = { number = "4242424242424242", exp_month = 12, exp_year = 2034, cvc = "123", holder_name = "Test Buyer" } }

[[steps]]
run = "payment.get"
with = { paymentId = "{{ payment.id }}" }
save = "paid"

[[steps]]
run = "assert"
with = { that = "{{ paid.status }} == succeeded" }
`,
  },
] as const;
