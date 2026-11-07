---
title: Settings in depth
description: Every control and text of every Settings section.
---

> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.

Settings changes how SendMock behaves, section by section; every change applies at once.

The screen as a whole: [Settings](../settings.md).

![Settings, with a number on each control](./images/settings.jpg)

The numbers match the entries below. The picture shows the first screenful; controls further down, and texts, have no marker.

## On the screen

### 1. Settings

Heading.

- **What it does:** Names the screen, in the header and above the sections.

### 2. Read the Settings guide

Link.

- **What it does:** Opens this screen's page in the user guide, in a new tab.
- **Links to:** [Settings](../settings.md).

### 3. Changes apply at once, without a restart. Export them to the seed file to keep them across resets.

Text.

- **What it does:** Explains how settings apply and how to keep them.
- **Same action elsewhere:** REST [`GET /api/v1/settings`](/api/system/#getSettings), CLI [`sendmock settings get`](/cli/system/#settings-get), MCP [`sendmock_settings_get`](/mcp/system/#sendmock_settings_get)

### 4. General

Link.

- **What it does:** Opens the General section: retention and the danger zone.

### 5. Seed

Link.

- **What it does:** Opens the Seed section: the seed file: export, validate and apply.

### 6. Email

Link.

- **What it does:** Opens the Email section: receiving, delivery outcomes, release, tag and forward rules, outcome addresses.

### 7. SMS

Link.

- **What it does:** Opens the SMS section: delivery simulation, Verify defaults, outcome numbers and magic numbers.

### 8. Payments

Link.

- **What it does:** Opens the Payments section: the hosted checkout and the test values.

### 9. Notifications

Link.

- **What it does:** Opens the Notifications section: pop-up toasts for new traffic.

### 10. Opened events

Link.

- **What it does:** Opens the Opened events section: when `email.opened` and `sms.opened` fire.

### 11. Chaos

Link.

- **What it does:** Opens the Chaos section: sMTP failures on purpose.

### 12. OTP patterns

Link.

- **What it does:** Opens the OTP patterns section: how one-time codes are found.

### 13. Connection

Link.

- **What it does:** Opens the Connection section: snippets for every language, provider base URLs and AI agents.

### 14. About

Link.

- **What it does:** Opens the About section: help links and the update check.

### 15. Retention

Heading.

- **What it does:** How much traffic is kept.

### 16. Older traffic is pruned when a limit is reached. Configuration is never pruned.

Text.

- **What it does:** Explains retention: emails, SMS, requests and deliveries are pruned; endpoints, rules and other configuration never.

### 17. Keep at most

Number field.

- **What it does:** The most emails kept (and the same limit for the other traffic).

### 18. Turn off to delete traffic after a number of days.

Text.

- **What it does:** Explains Keep forever.

### 19. Keep forever

Switch.

- **What it does:** When off, traffic older than the number of days you set is deleted too.

### 20. Discard

Button.

- **What it does:** Throws away the changes not saved yet.

### 21. Save changes

Button.

- **What it does:** Saves the section's changes; they apply at once.
- **Same action elsewhere:** REST [`PATCH /api/v1/settings`](/api/system/#patchSettings), CLI [`sendmock settings set`](/cli/system/#settings-set), MCP [`sendmock_settings_update`](/mcp/system/#sendmock_settings_update)

### 22. Danger zone

Heading.

- **What it does:** Actions that delete data.

### 23. These cannot be undone. Each asks first.

Text.

- **What it does:** Warns that these cannot be undone.

### 24. Delete all emails

Button.

- **What it does:** Asks first, then deletes every email.
- **Same action elsewhere:** REST [`DELETE /api/v1/emails`](/api/email/#deleteEmails), CLI [`sendmock email delete-all`](/cli/email/#email-delete-all), MCP [`sendmock_email_delete_all`](/mcp/email/#sendmock_email_delete_all)

### 25. Delete all SMS

Button.

- **What it does:** Asks first, then deletes every SMS.
- **Same action elsewhere:** REST [`DELETE /api/v1/sms`](/api/sms/#deleteSms), CLI [`sendmock sms delete-all`](/cli/sms/#sms-delete-all), MCP [`sendmock_sms_delete_all`](/mcp/sms/#sendmock_sms_delete_all)

### 26. Reset to seed

Button.

- **What it does:** Asks first, then wipes all traffic and puts the configuration back to the seed file.
- **Same action elsewhere:** REST [`POST /api/v1/reset`](/api/system/#postReset), CLI [`sendmock reset`](/cli/system/#reset), MCP [`sendmock_reset`](/mcp/system/#sendmock_reset)

## Seed section

### 27. Seed file

Heading.

- **What it does:** The seed file SendMock starts from and resets to.
- **Same action elsewhere:** REST [`GET /api/v1/seed/status`](/api/seed/#getSeedStatus), CLI [`sendmock seed status`](/cli/seed/#seed-status), MCP [`sendmock_seed_status`](/mcp/seed/#sendmock_seed_status)

### 28. The configuration SendMock starts from and resets to, kept in your repository.

Text.

- **What it does:** Explains the seed file.
- **Links to:** [Advanced: seed file](../advanced/seed-file.md).

### 29. ./sendmock.seed.toml applied Month #, #, #:#

Text.

- **What it does:** Which seed file was applied, and when.

### 30. # items are not in the seed file yet. Export to keep them after a reset.

Text.

- **What it does:** How much configuration a reset would lose.

### 31. Export sendmock.seed.toml

Button.

- **What it does:** Downloads the current configuration as a seed file; secrets are written as `${ENV}` references.
- **Same action elsewhere:** REST [`GET /api/v1/seed/export`](/api/seed/#getSeedExport), CLI [`sendmock seed export`](/cli/seed/#seed-export), MCP [`sendmock_seed_export`](/mcp/seed/#sendmock_seed_export)

### 32. Apply a seed file

Heading.

- **What it does:** Loads a seed file into the running SendMock.

### 33. Validate first; applying upserts every item in the file by name or SID.

Text.

- **What it does:** Explains applying.

### 34. Upload file

Button.

- **What it does:** Reads a seed file from your computer.

### 35. Seed file (TOML)

Field.

- **What it does:** The seed file's text.

### 36. Validate

Button.

- **What it does:** Checks the file without applying it and lists errors with their line.
- **Same action elsewhere:** REST [`POST /api/v1/seed/validate`](/api/seed/#postSeedValidate), CLI [`sendmock seed validate`](/cli/seed/#seed-validate), MCP [`sendmock_seed_validate`](/mcp/seed/#sendmock_seed_validate)

### 37. Apply

Button.

- **What it does:** Applies the file: every item in it is added or updated.
- **Same action elsewhere:** REST [`POST /api/v1/seed/apply`](/api/seed/#postSeedApply), CLI [`sendmock seed apply`](/cli/seed/#seed-apply), MCP [`sendmock_seed_apply`](/mcp/seed/#sendmock_seed_apply)

## Email section

### 38. Receiving and delivery outcomes

Heading.

- **What it does:** How arriving mail is tagged and what happens to it next.

### 39. user+invoice@app.test gets the tag invoice.

Text.

- **What it does:** An example of plus-address tagging.

### 40. Tag by plus address

Switch.

- **What it does:** Tags an email with the part after `+` in its recipient.

### 41. Off: the SES simulator and SendMock addresses below behave like any other address.

Text.

- **What it does:** Explains Magic addresses.

### 42. Magic addresses

Switch.

- **What it does:** Whether the magic addresses decide an outcome.
- **Links to:** [Magic numbers and addresses](../reference/magic-numbers.md).

### 43. Off No delivery events unless you simulate one or use a magic address.

Choice.

- **What it does:** No delivery outcome by itself.

### 44. Auto-delivered Every email gets email.delivered after a short delay.

Choice.

- **What it does:** Every email is delivered after a short delay.

### 45. Realistic A delay, plus the bounce and complaint rates below.

Choice.

- **What it does:** Delivered after a delay, with some bounces and complaints at the rates you set.

### 46. Remove inbound.app.test

Button.

- **What it does:** Removes an inbound domain (here the demo's).

### 47. Remove reply.app.test

Button.

- **What it does:** Removes an inbound domain (here the demo's reply domain).

### 48. Inbound domains

Field.

- **What it does:** A domain whose mail counts as incoming.

### 49. Add

Button.

- **What it does:** Adds the inbound domain.

### 50. Mail for these domains is incoming (replies, support inboxes) and fires email.inbound.

Text.

- **What it does:** Explains inbound domains.
- **Links to:** [Inbound routes](../webhooks/inbound-routes.md).

### 51. SpamAssassin address

Field.

- **What it does:** The `host:port` of a running `spamd` for the spam check.

### 52. host:port of a running spamd. Leave empty to turn the spam check off.

Text.

- **What it does:** Explains the SpamAssassin address.

### 53. Release to real SMTP

Heading.

- **What it does:** The relay that Release and auto-forward send through.
- **Links to:** [Release](../mail/release.md).

### 54. Release and auto-forward send through this relay, and only to allowed recipients.

Text.

- **What it does:** Explains the relay.

### 55. Relay SMTP URL

Field.

- **What it does:** The relay, such as `smtp://user:password@smtp.example.com:587`.

### 56. The password is stored and shown masked.

Text.

- **What it does:** Explains the masking.

### 57. Allowed recipients

Field.

- **What it does:** Globs of addresses Release may send to, such as `*@yourcompany.com`.

### 58. Release stays off until at least one pattern is added.

Text.

- **What it does:** Explains the safety rule.

### 59. Tag rules

Heading.

- **What it does:** Rules that tag arriving emails.
- **Same action elsewhere:** REST [`GET /api/v1/tag-rules`](/api/tag-rules/#getTagRules), CLI [`sendmock email tag-rules list`](/cli/tag-rules/#email-tag-rules-list), MCP [`sendmock_tag_rule_list`](/mcp/tag-rules/#sendmock_tag_rule_list)

### 60. Add a tag to arriving emails that match a filter, in this order. Tags show in the list and the tag: search.

Text.

- **What it does:** Explains tag rules.

### 61. Rule

Column.

- **What it does:** The rule's name.

### 62. When

Column.

- **What it does:** Its filter, in words.

### 63. Tag

Column.

- **What it does:** The tag it adds.

### 64. Enabled

Column.

- **What it does:** Whether it runs.

### 65. Actions

Column.

- **What it does:** Move, Edit and Delete.

### 66. Billing mail enabled

Switch.

- **What it does:** Turns the tag rule on or off (here the demo's "Billing mail").
- **Same action elsewhere:** REST [`PATCH /api/v1/tag-rules/{ruleId}`](/api/tag-rules/#patchTagRulesByRuleId), CLI [`sendmock email tag-rules update`](/cli/tag-rules/#email-tag-rules-update), MCP [`sendmock_tag_rule_update`](/mcp/tag-rules/#sendmock_tag_rule_update)

### 67. Move Billing mail up

Button.

- **What it does:** Runs the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/tag-rules/{ruleId}/move`](/api/tag-rules/#postTagRulesByRuleIdMove), CLI [`sendmock email tag-rules move`](/cli/tag-rules/#email-tag-rules-move), MCP [`sendmock_tag_rule_move`](/mcp/tag-rules/#sendmock_tag_rule_move)

### 68. Move Billing mail down

Button.

- **What it does:** Runs the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/tag-rules/{ruleId}/move`](/api/tag-rules/#postTagRulesByRuleIdMove), CLI [`sendmock email tag-rules move`](/cli/tag-rules/#email-tag-rules-move), MCP [`sendmock_tag_rule_move`](/mcp/tag-rules/#sendmock_tag_rule_move)

### 69. Edit Billing mail

Button.

- **What it does:** Opens the rule's editor: its name, its filter and what it does.
- **Same action elsewhere:** REST [`PATCH /api/v1/tag-rules/{ruleId}`](/api/tag-rules/#patchTagRulesByRuleId), CLI [`sendmock email tag-rules update`](/cli/tag-rules/#email-tag-rules-update), MCP [`sendmock_tag_rule_update`](/mcp/tag-rules/#sendmock_tag_rule_update)

### 70. Delete Billing mail

Button.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/tag-rules/{ruleId}`](/api/tag-rules/#deleteTagRulesByRuleId), CLI [`sendmock email tag-rules delete`](/cli/tag-rules/#email-tag-rules-delete), MCP [`sendmock_tag_rule_delete`](/mcp/tag-rules/#sendmock_tag_rule_delete)

### 71. Add rule

Button.

- **What it does:** Adds a tag or forward rule.
- **Same action elsewhere:** REST [`POST /api/v1/tag-rules`](/api/tag-rules/#postTagRules), CLI [`sendmock email tag-rules create`](/cli/tag-rules/#email-tag-rules-create), MCP [`sendmock_tag_rule_create`](/mcp/tag-rules/#sendmock_tag_rule_create)
- **Same action elsewhere:** REST [`POST /api/v1/forward-rules`](/api/forward-rules/#postForwardRules), CLI [`sendmock email forward-rules create`](/cli/forward-rules/#email-forward-rules-create), MCP [`sendmock_forward_rule_create`](/mcp/forward-rules/#sendmock_forward_rule_create)

### 72. Auto-forward rules

Heading.

- **What it does:** Rules that send a real copy of arriving emails.
- **Same action elsewhere:** REST [`GET /api/v1/forward-rules`](/api/forward-rules/#getForwardRules), CLI [`sendmock email forward-rules list`](/cli/forward-rules/#email-forward-rules-list), MCP [`sendmock_forward_rule_list`](/mcp/forward-rules/#sendmock_forward_rule_list)

### 73. Release a real copy of arriving emails that match a filter, through the relay above and only to allowed recipients.

Text.

- **What it does:** Explains auto-forward.

### 74. Forward to

Column.

- **What it does:** Where the copy goes.

### 75. QA inbox to the team enabled

Switch.

- **What it does:** Turns the forward rule on or off (here the demo's "QA inbox to the team").
- **Same action elsewhere:** REST [`PATCH /api/v1/forward-rules/{ruleId}`](/api/forward-rules/#patchForwardRulesByRuleId), CLI [`sendmock email forward-rules update`](/cli/forward-rules/#email-forward-rules-update), MCP [`sendmock_forward_rule_update`](/mcp/forward-rules/#sendmock_forward_rule_update)

### 76. Move QA inbox to the team up

Button.

- **What it does:** Runs the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/forward-rules/{ruleId}/move`](/api/forward-rules/#postForwardRulesByRuleIdMove), CLI [`sendmock email forward-rules move`](/cli/forward-rules/#email-forward-rules-move), MCP [`sendmock_forward_rule_move`](/mcp/forward-rules/#sendmock_forward_rule_move)

### 77. Move QA inbox to the team down

Button.

- **What it does:** Runs the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/forward-rules/{ruleId}/move`](/api/forward-rules/#postForwardRulesByRuleIdMove), CLI [`sendmock email forward-rules move`](/cli/forward-rules/#email-forward-rules-move), MCP [`sendmock_forward_rule_move`](/mcp/forward-rules/#sendmock_forward_rule_move)

### 78. Edit QA inbox to the team

Button.

- **What it does:** Opens the rule's editor: its name, its filter and what it does.
- **Same action elsewhere:** REST [`PATCH /api/v1/forward-rules/{ruleId}`](/api/forward-rules/#patchForwardRulesByRuleId), CLI [`sendmock email forward-rules update`](/cli/forward-rules/#email-forward-rules-update), MCP [`sendmock_forward_rule_update`](/mcp/forward-rules/#sendmock_forward_rule_update)

### 79. Delete QA inbox to the team

Button.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/forward-rules/{ruleId}`](/api/forward-rules/#deleteForwardRulesByRuleId), CLI [`sendmock email forward-rules delete`](/cli/forward-rules/#email-forward-rules-delete), MCP [`sendmock_forward_rule_delete`](/mcp/forward-rules/#sendmock_forward_rule_delete)

### 80. Custom outcome addresses

Heading.

- **What it does:** Your own addresses with a fixed delivery outcome.
- **Same action elsewhere:** REST [`GET /api/v1/outcome-rules/email`](/api/outcome-rules/#getOutcomeRulesEmail), CLI [`sendmock outcome-rule email list`](/cli/outcome-rules/#outcome-rule-email-list), MCP [`sendmock_outcome_rule_list`](/mcp/outcome-rules/#sendmock_outcome_rule_list)

### 81. Your own test addresses. The first enabled match wins, before the magic addresses and the profile.

Text.

- **What it does:** Explains the order outcomes are decided in.
- **Links to:** [Advanced: email outcome addresses](../advanced/email-outcome-addresses.md).

### 82. #

Column.

- **What it does:** The rule's place.

### 83. Address

Column.

- **What it does:** The address or pattern.

### 84. Outcome

Column.

- **What it does:** What happens to mail for it.

### 85. On

Column.

- **What it does:** Whether it is on.

### 86. Rule # enabled

Switch.

- **What it does:** Turns the rule on or off.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/email/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesEmailByRuleId), CLI [`sendmock outcome-rule email update`](/cli/outcome-rules/#outcome-rule-email-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 87. Move rule # up

Button.

- **What it does:** Checks the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesEmailByRuleIdMove), CLI [`sendmock outcome-rule email move`](/cli/outcome-rules/#outcome-rule-email-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 88. Move rule # down

Button.

- **What it does:** Checks the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesEmailByRuleIdMove), CLI [`sendmock outcome-rule email move`](/cli/outcome-rules/#outcome-rule-email-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 89. Edit rule #

Button.

- **What it does:** Opens the rule's editor.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/email/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesEmailByRuleId), CLI [`sendmock outcome-rule email update`](/cli/outcome-rules/#outcome-rule-email-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 90. Delete rule #

Button.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/outcome-rules/email/{ruleId}`](/api/outcome-rules/#deleteOutcomeRulesEmailByRuleId), CLI [`sendmock outcome-rule email delete`](/cli/outcome-rules/#outcome-rule-email-delete), MCP [`sendmock_outcome_rule_delete`](/mcp/outcome-rules/#sendmock_outcome_rule_delete)

### 91. Add address

Button.

- **What it does:** Adds an outcome address.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email`](/api/outcome-rules/#postOutcomeRulesEmail), CLI [`sendmock outcome-rule email create`](/cli/outcome-rules/#outcome-rule-email-create), MCP [`sendmock_outcome_rule_create`](/mcp/outcome-rules/#sendmock_outcome_rule_create)

### 92. Test an address

Field.

- **What it does:** Shows which rule, magic address or profile decides an address's outcome.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email/test`](/api/outcome-rules/#postOutcomeRulesEmailTest), CLI [`sendmock outcome-rule email test`](/cli/outcome-rules/#outcome-rule-email-test), MCP [`sendmock_outcome_rule_test`](/mcp/outcome-rules/#sendmock_outcome_rule_test)

### 93. Magic address: Hard bounce (# #.#.#)

Text.

- **What it does:** The answer for the address tested (here a magic address that bounces).

### 94. Magic addresses

Heading.

- **What it does:** The built-in test addresses.

### 95. Send to these to get a delivery outcome without touching any setting. Built in and read-only.

Text.

- **What it does:** Explains magic addresses.

### 96. Recipients

Heading.

- **What it does:** The magic addresses and what each does.

### 97. Recipient

Column.

- **What it does:** The address.

### 98. Code

Column.

- **What it does:** The SMTP code or outcome it gives.

### 99. Copy success@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `success@simulator.amazonses.com`.

### 100. Copy bounce@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `bounce@simulator.amazonses.com`.

### 101. Copy complaint@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `complaint@simulator.amazonses.com`.

### 102. Copy ooto@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `ooto@simulator.amazonses.com`.

### 103. Copy suppressionlist@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `suppressionlist@simulator.amazonses.com`.

## SMS section

### 104. Delivery simulation

Heading.

- **What it does:** How sent SMS move on from `queued`.

### 105. Instant Delivered as soon as it is sent.

Choice.

- **What it does:** Delivered at once.

### 106. Realistic Queued, sent after about # ms, delivered after # to # s.

Choice.

- **What it does:** Queued, then sent, then delivered after a short delay, as a carrier would.

### 107. Manual Stays sent until you set a status in the message drawer.

Choice.

- **What it does:** Stays sent until you choose its status by hand.

### 108. Failure rate

Slider.

- **What it does:** A share of sends that end undelivered or failed at random.

### 109. This share of sends ends undelivered or failed at random.

Text.

- **What it does:** Explains the failure rate.

### 110. Reject From numbers that are not Twilio magic numbers with #, like real test credentials.

Text.

- **What it does:** Explains Strict Twilio test mode.

### 111. Strict Twilio test mode

Switch.

- **What it does:** Refuses any `From` that is not one of Twilio's test numbers, with 21606, as Twilio's test credentials do.

### 112. Off: the Twilio test numbers and SendMock outcome numbers below behave like any other number.

Text.

- **What it does:** Explains Magic numbers.

### 113. Magic numbers

Switch.

- **What it does:** Whether the magic numbers decide an outcome.
- **Links to:** [Magic numbers and addresses](../reference/magic-numbers.md).

### 114. Verify defaults

Heading.

- **What it does:** What new Verify services start with.

### 115. New Verify services start with this code length and lifetime. A fixed code here is sent by every service that has none of its own.

Text.

- **What it does:** Explains the defaults.

### 116. Code length

Number field.

- **What it does:** The default code length, 4 to 10.

### 117. Code lifetime

Number field.

- **What it does:** How long codes stay valid by default.

### 118. Fixed code for every service

Field.

- **What it does:** A code every service without its own fixed code sends.

### 119. Leave it empty for random codes.

Text.

- **What it does:** Explains an empty fixed code.

### 120. Custom outcome numbers

Heading.

- **What it does:** Your own numbers with a fixed outcome.
- **Same action elsewhere:** REST [`GET /api/v1/outcome-rules/sms`](/api/outcome-rules/#getOutcomeRulesSms), CLI [`sendmock outcome-rule sms list`](/cli/outcome-rules/#outcome-rule-sms-list), MCP [`sendmock_outcome_rule_list`](/mcp/outcome-rules/#sendmock_outcome_rule_list)

### 121. Your own test numbers. The first enabled match wins, before the magic numbers and the profile.

Text.

- **What it does:** Explains the order outcomes are decided in.
- **Links to:** [Advanced: SMS outcome numbers](../advanced/sms-outcome-numbers.md).

### 122. #

Column.

- **What it does:** The rule's place.

### 123. Number

Column.

- **What it does:** The number or pattern.

### 124. Outcome

Column.

- **What it does:** What happens to mail for it.

### 125. On

Column.

- **What it does:** Whether it is on.

### 126. Actions

Column.

- **What it does:** Move, Edit and Delete.

### 127. Rule # enabled

Switch, in each row.

- **What it does:** Turns the rule on or off.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/sms/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesSmsByRuleId), CLI [`sendmock outcome-rule sms update`](/cli/outcome-rules/#outcome-rule-sms-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 128. Move rule # up

Button, in each row.

- **What it does:** Checks the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesSmsByRuleIdMove), CLI [`sendmock outcome-rule sms move`](/cli/outcome-rules/#outcome-rule-sms-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 129. Move rule # down

Button, in each row.

- **What it does:** Checks the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesSmsByRuleIdMove), CLI [`sendmock outcome-rule sms move`](/cli/outcome-rules/#outcome-rule-sms-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 130. Edit rule #

Button, in each row.

- **What it does:** Opens the rule's editor.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/sms/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesSmsByRuleId), CLI [`sendmock outcome-rule sms update`](/cli/outcome-rules/#outcome-rule-sms-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 131. Delete rule #

Button, in each row.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/outcome-rules/sms/{ruleId}`](/api/outcome-rules/#deleteOutcomeRulesSmsByRuleId), CLI [`sendmock outcome-rule sms delete`](/cli/outcome-rules/#outcome-rule-sms-delete), MCP [`sendmock_outcome_rule_delete`](/mcp/outcome-rules/#sendmock_outcome_rule_delete)

### 132. Add number

Button.

- **What it does:** Adds an outcome number.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms`](/api/outcome-rules/#postOutcomeRulesSms), CLI [`sendmock outcome-rule sms create`](/cli/outcome-rules/#outcome-rule-sms-create), MCP [`sendmock_outcome_rule_create`](/mcp/outcome-rules/#sendmock_outcome_rule_create)

### 133. Number is the

Drop-down.

- **What it does:** Whether the number tested is the recipient (`To`) or the sender (`From`).

### 134. Test a number

Field.

- **What it does:** Shows which rule, magic number or profile decides a number's outcome.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms/test`](/api/outcome-rules/#postOutcomeRulesSmsTest), CLI [`sendmock outcome-rule sms test`](/cli/outcome-rules/#outcome-rule-sms-test), MCP [`sendmock_outcome_rule_test`](/mcp/outcome-rules/#sendmock_outcome_rule_test)

### 135. Magic number: Invalid number (#)

Text.

- **What it does:** The answer for the number tested (here a magic number refused with 21211).

### 136. Magic numbers

Heading.

- **What it does:** The built-in test numbers.

### 137. Twilio's official test numbers, plus SendMock numbers for outcomes after sending. Built in and read-only.

Text.

- **What it does:** Explains magic numbers.

### 138. To numbers (Twilio)

Heading.

- **What it does:** Twilio's recipient test numbers.

### 139. To

Column.

- **What it does:** The number.

### 140. Code

Column.

- **What it does:** The SMTP code or outcome it gives.

### 141. Copy +#

Button, in each row.

- **What it does:** Copies the number.

### 142. From numbers (Twilio)

Heading.

- **What it does:** Twilio's sender test numbers.

### 143. From

Column.

- **What it does:** The number.

### 144. After-send outcomes (SendMock)

Heading.

- **What it does:** SendMock's numbers that change status after the send.

## Payments section

### 145. Checkout

Heading.

- **What it does:** The hosted checkout's settings.

### 146. Applies to the next hosted checkout.

Text.

- **What it does:** Explains when changes apply.

### 147. Merchant name

Field.

- **What it does:** The shop name on checkout pages.

### 148. Shown on checkout pages and as \{merchant\} in flow labels.

Text.

- **What it does:** Explains the merchant name.

### 149. Default currency

Drop-down.

- **What it does:** The currency of checkouts made without one.

### 150. For checkouts created without a currency.

Text.

- **What it does:** Explains the default currency.

### 151. Interactive Each checkout waits for you on its checkout page.

Choice.

- **What it does:** Each checkout waits for you to pay or decline on its page.

### 152. Always succeed New checkouts are paid at once, with their redirect and notifications.

Choice.

- **What it does:** Every checkout is paid at once.

### 153. Always decline New checkouts are declined at once (generic decline).

Choice.

- **What it does:** Every checkout is declined at once.

### 154. Random New checkouts succeed at the rate below, else are declined.

Choice.

- **What it does:** Checkouts succeed at a rate you set.

### 155. Test values

Heading.

- **What it does:** What the methods accept.

### 156. What the enabled methods accept on checkout pages, as each method's flow asks for it. Any future expiry and any CVC work with the test cards.

Text.

- **What it does:** Explains the test values.

### 157. Test cards

Heading.

- **What it does:** The test cards and their outcomes.
- **Same action elsewhere:** REST [`GET /api/v1/payments/test-cards`](/api/payments/#getPaymentsTestCards), CLI [`sendmock payments test-cards`](/cli/payments/#payments-test-cards), MCP [`sendmock_payment_test_cards`](/mcp/payments/#sendmock_payment_test_cards)

### 158. Method

Column.

- **What it does:** The method.

### 159. Offered by

Column.

- **What it does:** The gateways that offer it.

### 160. Card number

Column.

- **What it does:** The card number.

### 161. Outcome

Column.

- **What it does:** What happens to mail for it.

### 162. Copy # # # #

Button, in each row.

- **What it does:** Copies the card number.

### 163. Test numbers and codes

Heading.

- **What it does:** Wallet numbers and codes.

### 164. Number or code

Column.

- **What it does:** The number or code.

### 165. OTP and PIN

Column.

- **What it does:** The OTP and PIN that go with it.

### 166. Copy #

Button, in each row.

- **What it does:** Copies the number or code.

### 167. Other methods

Heading.

- **What it does:** Methods with no test value to type.

### 168. What happens

Column.

- **What it does:** What the method does on the checkout page.

### 169. Merchant credentials are set per gateway in Payments > Gateways ; test values are edited in Payments > Methods .

Text.

- **What it does:** Says where to change them.

### 170. Payments > Gateways

Link.

- **What it does:** Opens Payments > Gateways.
- **Links to:** [Gateways](../payments/gateways.md).

### 171. Payments > Methods

Link.

- **What it does:** Opens Payments > Methods.
- **Links to:** [Methods](../payments/methods.md).

## Notifications section

### 172. Notifications

Heading.

- **What it does:** Pop-up toasts for new traffic.

### 173. New emails, SMS and failed webhook deliveries. Saved in this browser only, and applied at once.

Text.

- **What it does:** Explains what notifies and where it is saved.

### 174. Off: no pop-ups; the bell at the top right still counts and lists every notification.

Text.

- **What it does:** Explains turning toasts off.

### 175. Show pop-up toasts

Switch.

- **What it does:** Shows a toast for each new email, SMS and failed delivery.

### 176. Top right Under the bell.

Choice.

- **What it does:** Shows toasts at the top right, under the bell.

### 177. Top center Above the page title.

Choice.

- **What it does:** Shows toasts at the top center.

### 178. Top left Over the sidebar.

Choice.

- **What it does:** Shows toasts at the top left.

### 179. Bottom right The default, out of the way of the header.

Choice.

- **What it does:** Shows toasts at the bottom right, the default.

### 180. Bottom center Above the page bottom.

Choice.

- **What it does:** Shows toasts at the bottom center.

### 181. Bottom left Over the sidebar footer.

Choice.

- **What it does:** Shows toasts at the bottom left.

## Opened events section

### 182. Opened events

Heading.

- **What it does:** When opens are recorded.

### 183. email.opened and sms.opened stand in for the recipient reading the message.

Text.

- **What it does:** Explains opened events.

### 184. Opening an email or scrolling an SMS into view counts as the recipient reading it.

Text.

- **What it does:** Explains what counts as an open.

### 185. Fire opened events when I view messages

Switch.

- **What it does:** Fires `email.opened` and `sms.opened` when you look at a message in SendMock.
- **Same action elsewhere:** REST [`PATCH /api/v1/settings`](/api/system/#patchSettings), CLI [`sendmock settings set`](/cli/system/#settings-set), MCP [`sendmock_settings_update`](/mcp/system/#sendmock_settings_update)

### 186. First open only One event per message, like most providers report.

Choice.

- **What it does:** One opened event per message.

### 187. Every open An event each time, for testing open counters.

Choice.

- **What it does:** An opened event each time.

## Chaos section

### 188. Chaos

Heading.

- **What it does:** SMTP failures on purpose.

### 189. Make SMTP fail on purpose to test retries and error handling. SMS failures use the failure rate in SMS settings.

Text.

- **What it does:** Explains chaos.

### 190. Reject the next

Number field.

- **What it does:** How many of the next messages are refused.

### 191. Counts down as messages arrive. # turns it off.

Text.

- **What it does:** Explains the countdown.

### 192. With code

Drop-down.

- **What it does:** The SMTP code they are refused with, such as 421 or 554.

### 193. Reject recipients matching

Field.

- **What it does:** A glob of recipients refused with 550.

### 194. Glob; matching recipients get # No such user. Leave empty to turn it off.

Text.

- **What it does:** Explains the recipient glob.

### 195. Latency per SMTP command

Number field.

- **What it does:** A delay before each SMTP reply.

### 196. The client sees the connection close mid-message and nothing is stored.

Text.

- **What it does:** Explains dropping the connection.

### 197. Drop the connection during DATA

Switch.

- **What it does:** Closes the connection in the middle of the message.

## OTP patterns section

### 198. OTP patterns

Heading.

- **What it does:** How one-time codes are found.
- **Links to:** [Advanced: OTP patterns](../advanced/otp-patterns.md).

### 199. Tried in order on every new email and SMS; the first capture group of the first match is the code.

Text.

- **What it does:** Explains the patterns.

### 200. Pattern #

Field, in each row.

- **What it does:** A regular expression; its first capture group is the code.

### 201. Remove pattern #

Button, in each row.

- **What it does:** Removes the pattern.

### 202. Add pattern

Button.

- **What it does:** Adds a pattern.

### 203. Restore defaults

Button.

- **What it does:** Brings back the built-in patterns.

### 204. Try a message

Field.

- **What it does:** Text to try the patterns on.

### 205. Pattern # found #

Text.

- **What it does:** Which pattern matched the message and the code it found.

## Connection section

### 206. Connect your app

Heading.

- **What it does:** Snippets for pointing your app at SendMock.

### 207. Point your app at SendMock. Provider SDKs are below, under Provider APIs; recipes are in the docs.

Text.

- **What it does:** Explains the section.
- **Links to:** [Connect your app](../connect/index.md).

### 208. Language

Drop-down.

- **What it does:** The language or framework of the snippets.

### 209. Where does your app run?

Drop-down.

- **What it does:** This machine, a container reaching the host, or the same Compose project; shared with the empty states.
- **Same action elsewhere:** REST [`GET /api/v1/info`](/api/system/#getInfo), CLI [`sendmock status`](/cli/system/#status), MCP [`sendmock_status`](/mcp/system/#sendmock_status)

### 210. SMTP

Heading.

- **What it does:** The SMTP snippet for the chosen language.

### 211. Copy SMTP snippet

Button.

- **What it does:** Copies the snippet.

### 212. Email API

Heading.

- **What it does:** The Email API snippet for the chosen language.

### 213. Copy Email API snippet

Button.

- **What it does:** Copies the snippet.

### 214. SMS API

Heading.

- **What it does:** The SMS API snippet for the chosen language.

### 215. Copy SMS API snippet

Button.

- **What it does:** Copies the snippet.

### 216. HTTP Catcher (point Slack, push or other webhooks here)

Heading.

- **What it does:** The HTTP Catcher (point Slack, push or other webhooks here) snippet for the chosen language.

### 217. Copy HTTP Catcher (point Slack, push or other webhooks here) snippet

Button.

- **What it does:** Copies the snippet.

### 218. Provider APIs

Heading.

- **What it does:** Base URLs to give the providers' SDKs.

### 219. Point a provider's SDK at SendMock: use this base URL, or the real path on the provider port (#.#.#.#:#). Change, remove or add providers in Mail > Providers and SMS > Providers.

Text.

- **What it does:** Explains the base URLs and the provider port.

### 220. Email

Heading.

- **What it does:** The email providers' base URLs.

### 221. …

Link, in each row.

- **What it does:** A provider's name; opens it in Mail > Providers or SMS > Providers.

### 222. Copy the … base URL

Button, in each row.

- **What it does:** Copies the provider's base URL.

### 223. SMS

Heading.

- **What it does:** The SMS providers' base URLs.

### 224. AI agents

Heading.

- **What it does:** Setting up an AI coding agent.
- **Links to:** [AI](../ai/index.md).

### 225. Let Claude Code, Codex, Cursor, Gemini CLI or VS Code drive SendMock through MCP and the agent skill.

Text.

- **What it does:** Explains the section.

### 226. AI agent

Drop-down.

- **What it does:** The agent to set up.
- **Same action elsewhere:** REST [`GET /api/v1/ai/agents`](/api/automation/#getAiAgents), CLI [`sendmock ai install`](/cli/automation/#ai-install), MCP [`sendmock_ai_agents`](/mcp/automation/#sendmock_ai_agents)

### 227. Install command

Heading.

- **What it does:** The command that sets the agent up.

### 228. Copy install command

Button.

- **What it does:** Copies `sendmock ai install` for the chosen agent.

### 229. MCP configuration

Heading.

- **What it does:** The MCP configuration, to add by hand instead.

### 230. Copy mcp configuration

Button.

- **What it does:** Copies the MCP configuration.

### 231. The install command writes the configuration to claude mcp add sendmock -- sendmock mcp and the skill to .claude/skills/sendmock/ , after showing what it will change.

Text.

- **What it does:** Says what the install command writes for the chosen agent (here Claude Code).

### 232. Download the skill

Link.

- **What it does:** Downloads the agent skill.
- **Same action elsewhere:** REST [`GET /api/v1/ai/skill`](/api/automation/#getAiSkill), CLI [`sendmock ai skill`](/cli/automation/#ai-skill)

## About section

### 233. About SendMock

Heading.

- **What it does:** The version and channel of the running SendMock.
- **Same action elsewhere:** REST [`GET /api/v1/info`](/api/system/#getInfo), CLI [`sendmock status`](/cli/system/#status), MCP [`sendmock_status`](/mcp/system/#sendmock_status)

### 234. Help and feedback

Heading.

- **What it does:** The help links, as in the Help menu.

### 235. Issue forms open on GitHub with your version, channel, OS and browser filled in; nothing you captured is sent.

Text.

- **What it does:** Explains what the issue forms carry.

### 236. Documentation

Link.

- **What it does:** Opens the docs in a new tab.

### 237. Keyboard shortcuts

Button.

- **What it does:** Opens the list of keyboard shortcuts.

### 238. What's new

Link.

- **What it does:** Opens the changelog.

### 239. Report an issue

Link.

- **What it does:** Opens GitHub's bug report form, filled in.

### 240. Request a feature

Link.

- **What it does:** Opens GitHub's feature request form, filled in.

### 241. Report a security issue

Link.

- **What it does:** Opens GitHub's private security report form.

### 242. Star on GitHub

Link.

- **What it does:** Opens the repository.

### 243. Updates

Heading.

- **What it does:** Whether SendMock looks for new releases.

### 244. Off by default: SendMock never calls out unless you choose Manual or Daily. Stable installs are offered stable releases; beta installs betas and stables.

Text.

- **What it does:** Explains the update check.

### 245. Off SendMock never calls out.

Choice.

- **What it does:** Never checks.

### 246. Manual Only when you press Check for updates.

Choice.

- **What it does:** Checks only when you ask.

### 247. Daily On start and once a day; a new version shows in the notifications.

Choice.

- **What it does:** Checks on start and once a day.

### 248. Check for updates

Button.

- **What it does:** Looks for a newer release now and shows how to upgrade.
- **Same action elsewhere:** REST [`GET /api/v1/updates`](/api/system/#getUpdates), CLI [`sendmock update check`](/cli/system/#update-check), MCP [`sendmock_update_check`](/mcp/system/#sendmock_update_check)

## Delete all emails dialog

### 249. Delete all emails?

Heading.

- **What it does:** The confirmation before deleting every email.

### 250. Every captured email, its attachments and its SMTP session link are removed. Configuration stays.

Text.

- **What it does:** Says what is deleted.

### 251. Cancel

Button.

- **What it does:** Closes the confirmation without doing anything.

### 252. Delete all emails

Button.

- **What it does:** Deletes every email.
- **Same action elsewhere:** REST [`DELETE /api/v1/emails`](/api/email/#deleteEmails), CLI [`sendmock email delete-all`](/cli/email/#email-delete-all), MCP [`sendmock_email_delete_all`](/mcp/email/#sendmock_email_delete_all)

## Delete all SMS dialog

### 253. Delete all SMS?

Heading.

- **What it does:** The confirmation before deleting every SMS.

### 254. Every captured SMS and WhatsApp message is removed. Numbers and services stay.

Text.

- **What it does:** Says what is deleted.

### 255. Cancel

Button.

- **What it does:** Closes the confirmation without doing anything.

### 256. Delete all SMS

Button.

- **What it does:** Deletes every SMS.
- **Same action elsewhere:** REST [`DELETE /api/v1/sms`](/api/sms/#deleteSms), CLI [`sendmock sms delete-all`](/cli/sms/#sms-delete-all), MCP [`sendmock_sms_delete_all`](/mcp/sms/#sendmock_sms_delete_all)

## Reset to seed dialog

### 257. Reset to seed?

Heading.

- **What it does:** The confirmation before a reset.

### 258. All traffic is wiped and the configuration goes back to the seed file. Changes not exported to the seed are lost.

Text.

- **What it does:** Says what a reset does.

### 259. Cancel

Button.

- **What it does:** Closes the confirmation without doing anything.

### 260. Reset

Button.

- **What it does:** Resets to the seed file.
- **Same action elsewhere:** REST [`POST /api/v1/reset`](/api/system/#postReset), CLI [`sendmock reset`](/cli/system/#reset), MCP [`sendmock_reset`](/mcp/system/#sendmock_reset)

## When the data cannot load

### 261. Could not load the settings. Try again

Message.

- **What it does:** Shown when the settings could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 262. Could not load the settings.

Text.

- **What it does:** The message inside the alert.

### 263. Try again

Button.

- **What it does:** Loads the settings again.
- **Same action elsewhere:** REST [`GET /api/v1/settings`](/api/system/#getSettings), CLI [`sendmock settings get`](/cli/system/#settings-get), MCP [`sendmock_settings_get`](/mcp/system/#sendmock_settings_get)
