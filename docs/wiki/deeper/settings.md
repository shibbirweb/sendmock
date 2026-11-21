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

### 3. Changes apply at once, without a restart. Export them as a setup to keep them across resets or carry them to another machine.

Text.

- **What it does:** Explains how settings apply and how to keep them.
- **Same action elsewhere:** REST [`GET /api/v1/settings`](/api/system/#getSettings), CLI [`sendmock settings get`](/cli/system/#settings-get), MCP [`sendmock_settings_get`](/mcp/system/#sendmock_settings_get)

### 4. General

Link.

- **What it does:** Opens the General section: retention and the danger zone.

### 5. Setup

Link.

- **What it does:** Opens the Setup section: the seed file, and exporting and importing a setup.

### 6. Projects

Link.

- **What it does:** Opens the Projects section: projects that keep apps' or developers' traffic apart.

### 7. Email

Link.

- **What it does:** Opens the Email section: receiving, delivery outcomes, release, tag and forward rules, outcome addresses.

### 8. SMS

Link.

- **What it does:** Opens the SMS section: delivery simulation, Verify defaults, outcome numbers and magic numbers.

### 9. Payments

Link.

- **What it does:** Opens the Payments section: the hosted checkout and the test values.

### 10. Notifications

Link.

- **What it does:** Opens the Notifications section: pop-up toasts for new traffic.

### 11. Opened events

Link.

- **What it does:** Opens the Opened events section: when `email.opened` and `sms.opened` fire.

### 12. Chaos

Link.

- **What it does:** Opens the Chaos section: sMTP failures on purpose.

### 13. OTP patterns

Link.

- **What it does:** Opens the OTP patterns section: how one-time codes are found.

### 14. Connection

Link.

- **What it does:** Opens the Connection section: snippets for every language, provider base URLs and AI agents.

### 15. About

Link.

- **What it does:** Opens the About section: help links and the update check.

### 16. Retention

Heading.

- **What it does:** How much traffic is kept.

### 17. Older traffic is pruned when a limit is reached; zero means no limit. Configuration is never pruned.

Text.

- **What it does:** Explains retention: emails, SMS, requests and deliveries are pruned; endpoints, rules and other configuration never.

### 18. Keep at most

Number field.

- **What it does:** The most emails kept, which also bounds SMTP sessions, API requests, HTTP requests and finished deliveries; the second field is the most SMS, which also bounds verifications and push notifications. 0 keeps everything, with a warning when no age limit is set.

### 19. Turn off to delete traffic after a number of days.

Text.

- **What it does:** Explains Keep forever.

### 20. Keep forever

Switch.

- **What it does:** When off, traffic older than the number of days you set is deleted too.

### 21. Discard

Button.

- **What it does:** Throws away the changes not saved yet.

### 22. Save changes

Button.

- **What it does:** Saves the section's changes; they apply at once.
- **Same action elsewhere:** REST [`PATCH /api/v1/settings`](/api/system/#patchSettings), CLI [`sendmock settings set`](/cli/system/#settings-set), MCP [`sendmock_settings_update`](/mcp/system/#sendmock_settings_update)

### 23. Danger zone

Heading.

- **What it does:** Actions that delete data.

### 24. These cannot be undone. Each asks first.

Text.

- **What it does:** Warns that these cannot be undone.

### 25. Delete all traffic

Button.

- **What it does:** Asks first, then deletes every email, SMS, verification, push notification, captured HTTP request, finished webhook delivery, payment, subscription and log entry, in every project; settings and configuration stay.
- **Same action elsewhere:** REST [`DELETE /api/v1/traffic`](/api/system/#deleteTraffic), CLI [`sendmock traffic delete-all`](/cli/system/#traffic-delete-all), MCP [`sendmock_traffic_delete_all`](/mcp/system/#sendmock_traffic_delete_all)

### 26. Delete all emails

Button.

- **What it does:** Asks first, then deletes every email.
- **Same action elsewhere:** REST [`DELETE /api/v1/emails`](/api/email/#deleteEmails), CLI [`sendmock email delete-all`](/cli/email/#email-delete-all), MCP [`sendmock_email_delete_all`](/mcp/email/#sendmock_email_delete_all)

### 27. Delete all SMS

Button.

- **What it does:** Asks first, then deletes every SMS.
- **Same action elsewhere:** REST [`DELETE /api/v1/sms`](/api/sms/#deleteSms), CLI [`sendmock sms delete-all`](/cli/sms/#sms-delete-all), MCP [`sendmock_sms_delete_all`](/mcp/sms/#sendmock_sms_delete_all)

### 28. Reset to seed

Button.

- **What it does:** Asks first, then wipes all traffic and puts the configuration back to the seed file.
- **Same action elsewhere:** REST [`POST /api/v1/reset`](/api/system/#postReset), CLI [`sendmock reset`](/cli/system/#reset), MCP [`sendmock_reset`](/mcp/system/#sendmock_reset)

## Setup section

### 29. Seed file

Heading.

- **What it does:** The seed file SendMock starts from and resets to.
- **Same action elsewhere:** REST [`GET /api/v1/seed/status`](/api/seed/#getSeedStatus), CLI [`sendmock seed status`](/cli/seed/#seed-status), MCP [`sendmock_seed_status`](/mcp/seed/#sendmock_seed_status)

### 30. The configuration SendMock starts from and resets to, kept in your repository.

Text.

- **What it does:** Explains the seed file.
- **Links to:** [Advanced: seed file](../advanced/seed-file.md).

### 31. ./sendmock.seed.toml applied Month #, #, #:#

Text.

- **What it does:** Which seed file was applied, and when.

### 32. # items are not in the seed file yet. Export to keep them after a reset.

Text.

- **What it does:** How much configuration a reset would lose.

### 33. Export sendmock.seed.toml

Button.

- **What it does:** Downloads the current configuration as a seed file; secrets are written as `${ENV}` references.
- **Same action elsewhere:** REST [`GET /api/v1/seed/export`](/api/seed/#getSeedExport), CLI [`sendmock seed export`](/cli/seed/#seed-export), MCP [`sendmock_seed_export`](/mcp/seed/#sendmock_seed_export)

### 34. Export a setup

Heading.

- **What it does:** Writes everything you configured, without traffic, as one setup file.

### 35. Everything you configured, without traffic, in one file to share with your team or carry to another machine.

Text.

- **What it does:** Explains what a setup holds.
- **Links to:** [Configuration](../configuration.md).

### 36. TOML

Choice.

- **What it does:** Writes the setup as TOML, the default.

### 37. JSON

Choice.

- **What it does:** Writes the setup as JSON.

### 38. YAML

Choice.

- **What it does:** Writes the setup as YAML.

### 39. Settings

Checkbox.

- **What it does:** Includes Settings in the export; all are on by default, and turning some off exports only the rest.

### 40. Projects

Checkbox.

- **What it does:** Includes Projects in the export; all are on by default, and turning some off exports only the rest.

### 41. Webhooks

Checkbox.

- **What it does:** Includes Webhooks in the export; all are on by default, and turning some off exports only the rest.

### 42. Email

Checkbox.

- **What it does:** Includes Email in the export; all are on by default, and turning some off exports only the rest.

### 43. SMS providers and outcome rules

Checkbox.

- **What it does:** Includes SMS providers and outcome rules in the export; all are on by default, and turning some off exports only the rest.

### 44. Virtual numbers

Checkbox.

- **What it does:** Includes Virtual numbers in the export; all are on by default, and turning some off exports only the rest.

### 45. Messaging Services

Checkbox.

- **What it does:** Includes Messaging Services in the export; all are on by default, and turning some off exports only the rest.

### 46. Verify services

Checkbox.

- **What it does:** Includes Verify services in the export; all are on by default, and turning some off exports only the rest.

### 47. Payments

Checkbox.

- **What it does:** Includes Payments in the export; all are on by default, and turning some off exports only the rest.

### 48. HTTP Catcher bins

Checkbox.

- **What it does:** Includes HTTP Catcher bins in the export; all are on by default, and turning some off exports only the rest.

### 49. Saved scenarios

Checkbox.

- **What it does:** Includes Saved scenarios in the export; all are on by default, and turning some off exports only the rest.

### 50. As $\{ENV_VAR\} references To share: the file holds no secret, and whoever imports it sets the variables.

Choice.

- **What it does:** Writes each secret as an `${ENV_VAR}` reference, the default.

### 51. Encrypted with a passphrase For your own machine: each secret is encrypted, and the import asks for the passphrase.

Choice.

- **What it does:** Writes each secret encrypted with the passphrase you type (8 characters or more); the import needs the same passphrase. SendMock does not keep it.

### 52. Export sendmock.setup.toml

Button.

- **What it does:** Downloads the setup in the chosen format; the name follows the format. Disabled while an encryption passphrase is shorter than 8 characters.
- **Same action elsewhere:** REST [`POST /api/v1/setup/export`](/api/setup/#postSetupExport), CLI [`sendmock setup export`](/cli/setup/#setup-export), MCP [`sendmock_setup_export`](/mcp/setup/#sendmock_setup_export)

### 53. Import a setup

Heading.

- **What it does:** Loads a setup file into the running SendMock.

### 54. Preview first: the import shows what it adds, changes and removes, and an invalid file changes nothing.

Text.

- **What it does:** Explains the preview.

### 55. File or text

Choice.

- **What it does:** Takes the setup from a file you upload or text you paste.

### 56. URL

Choice.

- **What it does:** Downloads the setup from an `https://` address, with an optional SHA-256 and headers for a private address.

### 57. Upload file

Button.

- **What it does:** Reads a setup file from your computer into the text box.

### 58. Setup file

Field.

- **What it does:** The setup file's text.

### 59. TOML, JSON or YAML; the format is read from the text.

Text.

- **What it does:** Says which formats are read.

### 60. Merge Add and update what the file holds by name; keep everything else.

Choice.

- **What it does:** Adds and updates what the file holds, the default.

### 61. Replace Also remove what the file does not hold, after a confirmation with the count.

Choice.

- **What it does:** Also removes what the file does not hold, after a confirmation that names how many items go.

### 62. Passphrase

Field.

- **What it does:** Opens the file's encrypted secrets.
- **Errors:** A missing or wrong passphrase is refused and nothing is applied.

### 63. Only for a file exported with encrypted secrets.

Text.

- **What it does:** Says when the passphrase is needed.

### 64. Preview

Button.

- **What it does:** Checks the file and lists, per section, what the import would add, change and remove. A file from an older SendMock is upgraded in memory; one from a newer SendMock is refused with the version to update to.
- **Errors:** Errors are listed by line or key path.
- **Same action elsewhere:** REST [`POST /api/v1/setup/validate`](/api/setup/#postSetupValidate), CLI [`sendmock setup validate`](/cli/setup/#setup-validate), MCP [`sendmock_setup_validate`](/mcp/setup/#sendmock_setup_validate)

### 65. Import

Button.

- **What it does:** Applies the file with Merge or Replace; Replace asks first with the number of items it removes.
- **What it changes:** Adds, updates and (with Replace) removes configuration; traffic is never touched.
- **Same action elsewhere:** REST [`POST /api/v1/setup/import`](/api/setup/#postSetupImport), CLI [`sendmock setup import`](/cli/setup/#setup-import), MCP [`sendmock_setup_import`](/mcp/setup/#sendmock_setup_import)

## Projects section

### 66. Projects

Heading.

- **What it does:** The projects that keep traffic apart.
- **Same action elsewhere:** REST [`GET /api/v1/projects`](/api/projects/#getProjects), CLI [`sendmock projects list`](/cli/projects/#projects-list), MCP [`sendmock_project_list`](/mcp/projects/#sendmock_project_list)

### 67. Keep apps' or developers' mail, SMS and codes apart in one SendMock. Settings, providers and webhooks are shared.

Text.

- **What it does:** Explains what a project holds and what every project shares.

### 68. Name

Column.

- **What it does:** The project's name, shown in the top bar picker.

### 69. Key

Column.

- **What it does:** What apps send to pick the project; it never changes.

### 70. Emails

Column.

- **What it does:** How many emails the project holds.

### 71. SMS

Column.

- **What it does:** How many SMS the project holds.

### 72. Codes

Column.

- **What it does:** How many verifications the project holds.

### 73. Actions

Column.

- **What it does:** Rename and Delete.

### 74. Rename Default

Button.

- **What it does:** Renames a project; its key stays the same, so apps keep sending to it.
- **Same action elsewhere:** REST [`PATCH /api/v1/projects/{projectKey}`](/api/projects/#patchProjectsByProjectKey), CLI [`sendmock projects update`](/cli/projects/#projects-update), MCP [`sendmock_project_update`](/mcp/projects/#sendmock_project_update)

### 75. New project

Button.

- **What it does:** Asks for a key and a name, then adds the project. The key is what apps send.
- **Same action elsewhere:** REST [`POST /api/v1/projects`](/api/projects/#postProjects), CLI [`sendmock projects create`](/cli/projects/#projects-create), MCP [`sendmock_project_create`](/mcp/projects/#sendmock_project_create)

### 76. Send to shop

Heading.

- **What it does:** How an app sends to a project, shown for the first project after Default (or `shop` until one exists).

### 77. Traffic that names no project goes to Default. A project you have not created is refused, so a typo shows at once.

Text.

- **What it does:** Explains where traffic without a project goes, and that unknown projects are refused.

### 78. Copy the SMTP username

Button.

- **What it does:** Copies the SMTP username that sends mail to the project.

### 79. Copy the header

Button.

- **What it does:** Copies the `X-SendMock-Project` header for the REST and provider APIs.

### 80. Copy the base URL

Button.

- **What it does:** Copies the provider port's base URL under `/projects/<key>/`, for SDKs that take a base URL.

## Email section

### 81. Receiving and delivery outcomes

Heading.

- **What it does:** How arriving mail is tagged and what happens to it next.

### 82. user+invoice@app.test gets the tag invoice.

Text.

- **What it does:** An example of plus-address tagging.

### 83. Tag by plus address

Switch.

- **What it does:** Tags an email with the part after `+` in its recipient.

### 84. Off: the SES simulator and SendMock addresses below behave like any other address.

Text.

- **What it does:** Explains Magic addresses.

### 85. Magic addresses

Switch.

- **What it does:** Whether the magic addresses decide an outcome.
- **Links to:** [Magic numbers and addresses](../reference/magic-numbers.md).

### 86. Off No delivery events unless you simulate one or use a magic address.

Choice.

- **What it does:** No delivery outcome by itself.

### 87. Auto-delivered Every email gets email.delivered after a short delay.

Choice.

- **What it does:** Every email is delivered after a short delay.

### 88. Realistic A delay, plus the bounce and complaint rates below.

Choice.

- **What it does:** Delivered after a delay, with some bounces and complaints at the rates you set.

### 89. Remove inbound.app.test

Button.

- **What it does:** Removes an inbound domain (here the demo's).

### 90. Remove reply.app.test

Button.

- **What it does:** Removes an inbound domain (here the demo's reply domain).

### 91. Inbound domains

Field.

- **What it does:** A domain whose mail counts as incoming.

### 92. Add

Button.

- **What it does:** Adds the inbound domain.

### 93. Mail for these domains is incoming (replies, support inboxes) and fires email.inbound.

Text.

- **What it does:** Explains inbound domains.
- **Links to:** [Inbound routes](../webhooks/inbound-routes.md).

### 94. SpamAssassin address

Field.

- **What it does:** The `host:port` of a running `spamd` for the spam check.

### 95. host:port of a running spamd. Leave empty to turn the spam check off.

Text.

- **What it does:** Explains the SpamAssassin address.

### 96. Release to real SMTP

Heading.

- **What it does:** The relay that Release and auto-forward send through.
- **Links to:** [Release](../mail/release.md).

### 97. Release and auto-forward send through this relay, and only to allowed recipients.

Text.

- **What it does:** Explains the relay.

### 98. Relay SMTP URL

Field.

- **What it does:** The relay, such as `smtp://user:password@smtp.example.com:587`.

### 99. The password is stored and shown masked.

Text.

- **What it does:** Explains the masking.

### 100. Allowed recipients

Field.

- **What it does:** Globs of addresses Release may send to, such as `*@yourcompany.com`.

### 101. Release stays off until at least one pattern is added.

Text.

- **What it does:** Explains the safety rule.

### 102. Tag rules

Heading.

- **What it does:** Rules that tag arriving emails.
- **Same action elsewhere:** REST [`GET /api/v1/tag-rules`](/api/tag-rules/#getTagRules), CLI [`sendmock email tag-rules list`](/cli/tag-rules/#email-tag-rules-list), MCP [`sendmock_tag_rule_list`](/mcp/tag-rules/#sendmock_tag_rule_list)

### 103. Add a tag to arriving emails that match a filter, in this order. Tags show in the list and the tag: search.

Text.

- **What it does:** Explains tag rules.

### 104. Rule

Column.

- **What it does:** The rule's name.

### 105. When

Column.

- **What it does:** Its filter, in words.

### 106. Tag

Column.

- **What it does:** The tag it adds.

### 107. Enabled

Column.

- **What it does:** Whether it runs.

### 108. Actions

Column.

- **What it does:** Move, Edit and Delete.

### 109. Billing mail enabled

Switch.

- **What it does:** Turns the tag rule on or off (here the demo's "Billing mail").
- **Same action elsewhere:** REST [`PATCH /api/v1/tag-rules/{ruleId}`](/api/tag-rules/#patchTagRulesByRuleId), CLI [`sendmock email tag-rules update`](/cli/tag-rules/#email-tag-rules-update), MCP [`sendmock_tag_rule_update`](/mcp/tag-rules/#sendmock_tag_rule_update)

### 110. Move Billing mail up

Button.

- **What it does:** Runs the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/tag-rules/{ruleId}/move`](/api/tag-rules/#postTagRulesByRuleIdMove), CLI [`sendmock email tag-rules move`](/cli/tag-rules/#email-tag-rules-move), MCP [`sendmock_tag_rule_move`](/mcp/tag-rules/#sendmock_tag_rule_move)

### 111. Move Billing mail down

Button.

- **What it does:** Runs the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/tag-rules/{ruleId}/move`](/api/tag-rules/#postTagRulesByRuleIdMove), CLI [`sendmock email tag-rules move`](/cli/tag-rules/#email-tag-rules-move), MCP [`sendmock_tag_rule_move`](/mcp/tag-rules/#sendmock_tag_rule_move)

### 112. Edit Billing mail

Button.

- **What it does:** Opens the rule's editor: its name, its filter and what it does.
- **Same action elsewhere:** REST [`PATCH /api/v1/tag-rules/{ruleId}`](/api/tag-rules/#patchTagRulesByRuleId), CLI [`sendmock email tag-rules update`](/cli/tag-rules/#email-tag-rules-update), MCP [`sendmock_tag_rule_update`](/mcp/tag-rules/#sendmock_tag_rule_update)

### 113. Delete Billing mail

Button.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/tag-rules/{ruleId}`](/api/tag-rules/#deleteTagRulesByRuleId), CLI [`sendmock email tag-rules delete`](/cli/tag-rules/#email-tag-rules-delete), MCP [`sendmock_tag_rule_delete`](/mcp/tag-rules/#sendmock_tag_rule_delete)

### 114. Add rule

Button.

- **What it does:** Adds a tag or forward rule.
- **Same action elsewhere:** REST [`POST /api/v1/tag-rules`](/api/tag-rules/#postTagRules), CLI [`sendmock email tag-rules create`](/cli/tag-rules/#email-tag-rules-create), MCP [`sendmock_tag_rule_create`](/mcp/tag-rules/#sendmock_tag_rule_create)
- **Same action elsewhere:** REST [`POST /api/v1/forward-rules`](/api/forward-rules/#postForwardRules), CLI [`sendmock email forward-rules create`](/cli/forward-rules/#email-forward-rules-create), MCP [`sendmock_forward_rule_create`](/mcp/forward-rules/#sendmock_forward_rule_create)

### 115. Auto-forward rules

Heading.

- **What it does:** Rules that send a real copy of arriving emails.
- **Same action elsewhere:** REST [`GET /api/v1/forward-rules`](/api/forward-rules/#getForwardRules), CLI [`sendmock email forward-rules list`](/cli/forward-rules/#email-forward-rules-list), MCP [`sendmock_forward_rule_list`](/mcp/forward-rules/#sendmock_forward_rule_list)

### 116. Release a real copy of arriving emails that match a filter, through the relay above and only to allowed recipients.

Text.

- **What it does:** Explains auto-forward.

### 117. Forward to

Column.

- **What it does:** Where the copy goes.

### 118. QA inbox to the team enabled

Switch.

- **What it does:** Turns the forward rule on or off (here the demo's "QA inbox to the team").
- **Same action elsewhere:** REST [`PATCH /api/v1/forward-rules/{ruleId}`](/api/forward-rules/#patchForwardRulesByRuleId), CLI [`sendmock email forward-rules update`](/cli/forward-rules/#email-forward-rules-update), MCP [`sendmock_forward_rule_update`](/mcp/forward-rules/#sendmock_forward_rule_update)

### 119. Move QA inbox to the team up

Button.

- **What it does:** Runs the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/forward-rules/{ruleId}/move`](/api/forward-rules/#postForwardRulesByRuleIdMove), CLI [`sendmock email forward-rules move`](/cli/forward-rules/#email-forward-rules-move), MCP [`sendmock_forward_rule_move`](/mcp/forward-rules/#sendmock_forward_rule_move)

### 120. Move QA inbox to the team down

Button.

- **What it does:** Runs the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/forward-rules/{ruleId}/move`](/api/forward-rules/#postForwardRulesByRuleIdMove), CLI [`sendmock email forward-rules move`](/cli/forward-rules/#email-forward-rules-move), MCP [`sendmock_forward_rule_move`](/mcp/forward-rules/#sendmock_forward_rule_move)

### 121. Edit QA inbox to the team

Button.

- **What it does:** Opens the rule's editor: its name, its filter and what it does.
- **Same action elsewhere:** REST [`PATCH /api/v1/forward-rules/{ruleId}`](/api/forward-rules/#patchForwardRulesByRuleId), CLI [`sendmock email forward-rules update`](/cli/forward-rules/#email-forward-rules-update), MCP [`sendmock_forward_rule_update`](/mcp/forward-rules/#sendmock_forward_rule_update)

### 122. Delete QA inbox to the team

Button.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/forward-rules/{ruleId}`](/api/forward-rules/#deleteForwardRulesByRuleId), CLI [`sendmock email forward-rules delete`](/cli/forward-rules/#email-forward-rules-delete), MCP [`sendmock_forward_rule_delete`](/mcp/forward-rules/#sendmock_forward_rule_delete)

### 123. Custom outcome addresses

Heading.

- **What it does:** Your own addresses with a fixed delivery outcome.
- **Same action elsewhere:** REST [`GET /api/v1/outcome-rules/email`](/api/outcome-rules/#getOutcomeRulesEmail), CLI [`sendmock outcome-rule email list`](/cli/outcome-rules/#outcome-rule-email-list), MCP [`sendmock_outcome_rule_list`](/mcp/outcome-rules/#sendmock_outcome_rule_list)

### 124. Your own test addresses. The first enabled match wins, before the magic addresses and the profile.

Text.

- **What it does:** Explains the order outcomes are decided in.
- **Links to:** [Advanced: email outcome addresses](../advanced/email-outcome-addresses.md).

### 125. #

Column.

- **What it does:** The rule's place.

### 126. Address

Column.

- **What it does:** The address or pattern.

### 127. Outcome

Column.

- **What it does:** What happens to mail for it.

### 128. On

Column.

- **What it does:** Whether it is on.

### 129. Rule # enabled

Switch.

- **What it does:** Turns the rule on or off.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/email/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesEmailByRuleId), CLI [`sendmock outcome-rule email update`](/cli/outcome-rules/#outcome-rule-email-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 130. Move rule # up

Button.

- **What it does:** Checks the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesEmailByRuleIdMove), CLI [`sendmock outcome-rule email move`](/cli/outcome-rules/#outcome-rule-email-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 131. Move rule # down

Button.

- **What it does:** Checks the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesEmailByRuleIdMove), CLI [`sendmock outcome-rule email move`](/cli/outcome-rules/#outcome-rule-email-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 132. Edit rule #

Button.

- **What it does:** Opens the rule's editor.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/email/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesEmailByRuleId), CLI [`sendmock outcome-rule email update`](/cli/outcome-rules/#outcome-rule-email-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 133. Delete rule #

Button.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/outcome-rules/email/{ruleId}`](/api/outcome-rules/#deleteOutcomeRulesEmailByRuleId), CLI [`sendmock outcome-rule email delete`](/cli/outcome-rules/#outcome-rule-email-delete), MCP [`sendmock_outcome_rule_delete`](/mcp/outcome-rules/#sendmock_outcome_rule_delete)

### 134. Add address

Button.

- **What it does:** Adds an outcome address.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email`](/api/outcome-rules/#postOutcomeRulesEmail), CLI [`sendmock outcome-rule email create`](/cli/outcome-rules/#outcome-rule-email-create), MCP [`sendmock_outcome_rule_create`](/mcp/outcome-rules/#sendmock_outcome_rule_create)

### 135. Test an address

Field.

- **What it does:** Shows which rule, magic address or profile decides an address's outcome.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/email/test`](/api/outcome-rules/#postOutcomeRulesEmailTest), CLI [`sendmock outcome-rule email test`](/cli/outcome-rules/#outcome-rule-email-test), MCP [`sendmock_outcome_rule_test`](/mcp/outcome-rules/#sendmock_outcome_rule_test)

### 136. Magic address: Hard bounce (# #.#.#)

Text.

- **What it does:** The answer for the address tested (here a magic address that bounces).

### 137. Magic addresses

Heading.

- **What it does:** The built-in test addresses.

### 138. Send to these to get a delivery outcome without touching any setting. Built in and read-only.

Text.

- **What it does:** Explains magic addresses.

### 139. Recipients

Heading.

- **What it does:** The magic addresses and what each does.

### 140. Recipient

Column.

- **What it does:** The address.

### 141. Code

Column.

- **What it does:** The SMTP code or outcome it gives.

### 142. Copy success@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `success@simulator.amazonses.com`.

### 143. Copy bounce@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `bounce@simulator.amazonses.com`.

### 144. Copy complaint@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `complaint@simulator.amazonses.com`.

### 145. Copy ooto@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `ooto@simulator.amazonses.com`.

### 146. Copy suppressionlist@simulator.amazonses.com

Button.

- **What it does:** Copies the Amazon SES simulator address `suppressionlist@simulator.amazonses.com`.

## SMS section

### 147. Delivery simulation

Heading.

- **What it does:** How sent SMS move on from `queued`.

### 148. Instant Delivered as soon as it is sent.

Choice.

- **What it does:** Delivered at once.

### 149. Realistic Queued, sent after about # ms, delivered after # to # s.

Choice.

- **What it does:** Queued, then sent, then delivered after a short delay, as a carrier would.

### 150. Manual Stays sent until you set a status in the message drawer.

Choice.

- **What it does:** Stays sent until you choose its status by hand.

### 151. Failure rate

Slider.

- **What it does:** A share of sends that end undelivered or failed at random.

### 152. This share of sends ends undelivered or failed at random.

Text.

- **What it does:** Explains the failure rate.

### 153. Reject From numbers that are not Twilio magic numbers with #, like real test credentials.

Text.

- **What it does:** Explains Strict Twilio test mode.

### 154. Strict Twilio test mode

Switch.

- **What it does:** Refuses any `From` that is not one of Twilio's test numbers, with 21606, as Twilio's test credentials do.

### 155. Off: the Twilio test numbers and SendMock outcome numbers below behave like any other number.

Text.

- **What it does:** Explains Magic numbers.

### 156. Magic numbers

Switch.

- **What it does:** Whether the magic numbers decide an outcome.
- **Links to:** [Magic numbers and addresses](../reference/magic-numbers.md).

### 157. Verify defaults

Heading.

- **What it does:** What new Verify services start with.

### 158. New Verify services start with this code length and lifetime. A fixed code here is sent by every service that has none of its own.

Text.

- **What it does:** Explains the defaults.

### 159. Code length

Number field.

- **What it does:** The default code length, 4 to 10.

### 160. Code lifetime

Number field.

- **What it does:** How long codes stay valid by default.

### 161. Fixed code for every service

Field.

- **What it does:** A code every service without its own fixed code sends.

### 162. Leave it empty for random codes.

Text.

- **What it does:** Explains an empty fixed code.

### 163. Custom outcome numbers

Heading.

- **What it does:** Your own numbers with a fixed outcome.
- **Same action elsewhere:** REST [`GET /api/v1/outcome-rules/sms`](/api/outcome-rules/#getOutcomeRulesSms), CLI [`sendmock outcome-rule sms list`](/cli/outcome-rules/#outcome-rule-sms-list), MCP [`sendmock_outcome_rule_list`](/mcp/outcome-rules/#sendmock_outcome_rule_list)

### 164. Your own test numbers. The first enabled match wins, before the magic numbers and the profile.

Text.

- **What it does:** Explains the order outcomes are decided in.
- **Links to:** [Advanced: SMS outcome numbers](../advanced/sms-outcome-numbers.md).

### 165. #

Column.

- **What it does:** The rule's place.

### 166. Number

Column.

- **What it does:** The number or pattern.

### 167. Outcome

Column.

- **What it does:** What happens to mail for it.

### 168. On

Column.

- **What it does:** Whether it is on.

### 169. Actions

Column.

- **What it does:** Move, Edit and Delete.

### 170. Rule # enabled

Switch, in each row.

- **What it does:** Turns the rule on or off.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/sms/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesSmsByRuleId), CLI [`sendmock outcome-rule sms update`](/cli/outcome-rules/#outcome-rule-sms-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 171. Move rule # up

Button, in each row.

- **What it does:** Checks the rule earlier.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesSmsByRuleIdMove), CLI [`sendmock outcome-rule sms move`](/cli/outcome-rules/#outcome-rule-sms-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 172. Move rule # down

Button, in each row.

- **What it does:** Checks the rule later.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms/{ruleId}/move`](/api/outcome-rules/#postOutcomeRulesSmsByRuleIdMove), CLI [`sendmock outcome-rule sms move`](/cli/outcome-rules/#outcome-rule-sms-move), MCP [`sendmock_outcome_rule_move`](/mcp/outcome-rules/#sendmock_outcome_rule_move)

### 173. Edit rule #

Button, in each row.

- **What it does:** Opens the rule's editor.
- **Same action elsewhere:** REST [`PATCH /api/v1/outcome-rules/sms/{ruleId}`](/api/outcome-rules/#patchOutcomeRulesSmsByRuleId), CLI [`sendmock outcome-rule sms update`](/cli/outcome-rules/#outcome-rule-sms-update), MCP [`sendmock_outcome_rule_update`](/mcp/outcome-rules/#sendmock_outcome_rule_update)

### 174. Delete rule #

Button, in each row.

- **What it does:** Deletes the rule after you confirm.
- **Same action elsewhere:** REST [`DELETE /api/v1/outcome-rules/sms/{ruleId}`](/api/outcome-rules/#deleteOutcomeRulesSmsByRuleId), CLI [`sendmock outcome-rule sms delete`](/cli/outcome-rules/#outcome-rule-sms-delete), MCP [`sendmock_outcome_rule_delete`](/mcp/outcome-rules/#sendmock_outcome_rule_delete)

### 175. Add number

Button.

- **What it does:** Adds an outcome number.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms`](/api/outcome-rules/#postOutcomeRulesSms), CLI [`sendmock outcome-rule sms create`](/cli/outcome-rules/#outcome-rule-sms-create), MCP [`sendmock_outcome_rule_create`](/mcp/outcome-rules/#sendmock_outcome_rule_create)

### 176. Number is the

Drop-down.

- **What it does:** Whether the number tested is the recipient (`To`) or the sender (`From`).

### 177. Test a number

Field.

- **What it does:** Shows which rule, magic number or profile decides a number's outcome.
- **Same action elsewhere:** REST [`POST /api/v1/outcome-rules/sms/test`](/api/outcome-rules/#postOutcomeRulesSmsTest), CLI [`sendmock outcome-rule sms test`](/cli/outcome-rules/#outcome-rule-sms-test), MCP [`sendmock_outcome_rule_test`](/mcp/outcome-rules/#sendmock_outcome_rule_test)

### 178. Magic number: Invalid number (#)

Text.

- **What it does:** The answer for the number tested (here a magic number refused with 21211).

### 179. Magic numbers

Heading.

- **What it does:** The built-in test numbers.

### 180. Twilio's official test numbers, plus SendMock numbers for outcomes after sending. Built in and read-only.

Text.

- **What it does:** Explains magic numbers.

### 181. To numbers (Twilio)

Heading.

- **What it does:** Twilio's recipient test numbers.

### 182. To

Column.

- **What it does:** The number.

### 183. Code

Column.

- **What it does:** The SMTP code or outcome it gives.

### 184. Copy +#

Button, in each row.

- **What it does:** Copies the number.

### 185. From numbers (Twilio)

Heading.

- **What it does:** Twilio's sender test numbers.

### 186. From

Column.

- **What it does:** The number.

### 187. After-send outcomes (SendMock)

Heading.

- **What it does:** SendMock's numbers that change status after the send.

## Payments section

### 188. Checkout

Heading.

- **What it does:** The hosted checkout's settings.

### 189. Applies to the next hosted checkout.

Text.

- **What it does:** Explains when changes apply.

### 190. Merchant name

Field.

- **What it does:** The shop name on checkout pages.

### 191. Shown on checkout pages and as \{merchant\} in flow labels.

Text.

- **What it does:** Explains the merchant name.

### 192. Default currency

Drop-down.

- **What it does:** The currency of checkouts made without one.

### 193. For checkouts created without a currency.

Text.

- **What it does:** Explains the default currency.

### 194. Interactive Each checkout waits for you on its checkout page.

Choice.

- **What it does:** Each checkout waits for you to pay or decline on its page.

### 195. Always succeed New checkouts are paid at once, with their redirect and notifications.

Choice.

- **What it does:** Every checkout is paid at once.

### 196. Always decline New checkouts are declined at once (generic decline).

Choice.

- **What it does:** Every checkout is declined at once.

### 197. Random New checkouts succeed at the rate below, else are declined.

Choice.

- **What it does:** Checkouts succeed at a rate you set.

### 198. Test values

Heading.

- **What it does:** What the methods accept.

### 199. What the enabled methods accept on checkout pages, as each method's flow asks for it. Any future expiry and any CVC work with the test cards.

Text.

- **What it does:** Explains the test values.

### 200. Test cards

Heading.

- **What it does:** The test cards and their outcomes.
- **Same action elsewhere:** REST [`GET /api/v1/payments/test-cards`](/api/payments/#getPaymentsTestCards), CLI [`sendmock payments test-cards`](/cli/payments/#payments-test-cards), MCP [`sendmock_payment_test_cards`](/mcp/payments/#sendmock_payment_test_cards)

### 201. Method

Column.

- **What it does:** The method.

### 202. Offered by

Column.

- **What it does:** The gateways that offer it.

### 203. Card number

Column.

- **What it does:** The card number.

### 204. Outcome

Column.

- **What it does:** What happens to mail for it.

### 205. Copy # # # #

Button, in each row.

- **What it does:** Copies the card number.

### 206. Test numbers and codes

Heading.

- **What it does:** Wallet numbers and codes.

### 207. Number or code

Column.

- **What it does:** The number or code.

### 208. OTP and PIN

Column.

- **What it does:** The OTP and PIN that go with it.

### 209. Copy #

Button, in each row.

- **What it does:** Copies the number or code.

### 210. Other methods

Heading.

- **What it does:** Methods with no test value to type.

### 211. What happens

Column.

- **What it does:** What the method does on the checkout page.

### 212. Merchant credentials are set per gateway in Payments > Gateways ; test values are edited in Payments > Methods .

Text.

- **What it does:** Says where to change them.

### 213. Payments > Gateways

Link.

- **What it does:** Opens Payments > Gateways.
- **Links to:** [Gateways](../payments/gateways.md).

### 214. Payments > Methods

Link.

- **What it does:** Opens Payments > Methods.
- **Links to:** [Methods](../payments/methods.md).

## Notifications section

### 215. Notifications

Heading.

- **What it does:** Pop-up toasts for new traffic.

### 216. New emails, SMS and failed webhook deliveries. Saved in this browser only, and applied at once.

Text.

- **What it does:** Explains what notifies and where it is saved.

### 217. Off: no pop-ups; the bell at the top right still counts and lists every notification.

Text.

- **What it does:** Explains turning toasts off.

### 218. Show pop-up toasts

Switch.

- **What it does:** Shows a toast for each new email, SMS and failed delivery.

### 219. Top right Under the bell.

Choice.

- **What it does:** Shows toasts at the top right, under the bell.

### 220. Top center Above the page title.

Choice.

- **What it does:** Shows toasts at the top center.

### 221. Top left Over the sidebar.

Choice.

- **What it does:** Shows toasts at the top left.

### 222. Bottom right The default, out of the way of the header.

Choice.

- **What it does:** Shows toasts at the bottom right, the default.

### 223. Bottom center Above the page bottom.

Choice.

- **What it does:** Shows toasts at the bottom center.

### 224. Bottom left Over the sidebar footer.

Choice.

- **What it does:** Shows toasts at the bottom left.

## Opened events section

### 225. Opened events

Heading.

- **What it does:** When opens are recorded.

### 226. email.opened and sms.opened stand in for the recipient reading the message.

Text.

- **What it does:** Explains opened events.

### 227. Opening an email or scrolling an SMS into view counts as the recipient reading it.

Text.

- **What it does:** Explains what counts as an open.

### 228. Fire opened events when I view messages

Switch.

- **What it does:** Fires `email.opened` and `sms.opened` when you look at a message in SendMock.
- **Same action elsewhere:** REST [`PATCH /api/v1/settings`](/api/system/#patchSettings), CLI [`sendmock settings set`](/cli/system/#settings-set), MCP [`sendmock_settings_update`](/mcp/system/#sendmock_settings_update)

### 229. First open only One event per message, like most providers report.

Choice.

- **What it does:** One opened event per message.

### 230. Every open An event each time, for testing open counters.

Choice.

- **What it does:** An opened event each time.

## Chaos section

### 231. Chaos

Heading.

- **What it does:** SMTP failures on purpose.

### 232. Make SMTP fail on purpose to test retries and error handling. SMS failures use the failure rate in SMS settings.

Text.

- **What it does:** Explains chaos.

### 233. Reject the next

Number field.

- **What it does:** How many of the next messages are refused.

### 234. Counts down as messages arrive. # turns it off.

Text.

- **What it does:** Explains the countdown.

### 235. With code

Drop-down.

- **What it does:** The SMTP code they are refused with, such as 421 or 554.

### 236. Reject recipients matching

Field.

- **What it does:** A glob of recipients refused with 550.

### 237. Glob; matching recipients get # No such user. Leave empty to turn it off.

Text.

- **What it does:** Explains the recipient glob.

### 238. Latency per SMTP command

Number field.

- **What it does:** A delay before each SMTP reply.

### 239. The client sees the connection close mid-message and nothing is stored.

Text.

- **What it does:** Explains dropping the connection.

### 240. Drop the connection during DATA

Switch.

- **What it does:** Closes the connection in the middle of the message.

## OTP patterns section

### 241. OTP patterns

Heading.

- **What it does:** How one-time codes are found.
- **Links to:** [Advanced: OTP patterns](../advanced/otp-patterns.md).

### 242. Tried in order on every new email and SMS; the first capture group of the first match is the code.

Text.

- **What it does:** Explains the patterns.

### 243. Pattern #

Field, in each row.

- **What it does:** A regular expression; its first capture group is the code.

### 244. Remove pattern #

Button, in each row.

- **What it does:** Removes the pattern.

### 245. Add pattern

Button.

- **What it does:** Adds a pattern.

### 246. Restore defaults

Button.

- **What it does:** Brings back the built-in patterns.

### 247. Try a message

Field.

- **What it does:** Text to try the patterns on.

### 248. Pattern # found #

Text.

- **What it does:** Which pattern matched the message and the code it found.

## Connection section

### 249. Connect your app

Heading.

- **What it does:** Snippets for pointing your app at SendMock.

### 250. Point your app at SendMock. Provider SDKs are below, under Provider APIs; recipes are in the docs.

Text.

- **What it does:** Explains the section.
- **Links to:** [Connect your app](../connect/index.md).

### 251. Language

Drop-down.

- **What it does:** The language or framework of the snippets.

### 252. Where does your app run?

Drop-down.

- **What it does:** This machine, a container reaching the host, or the same Compose project; shared with the empty states.
- **Same action elsewhere:** REST [`GET /api/v1/info`](/api/system/#getInfo), CLI [`sendmock status`](/cli/system/#status), MCP [`sendmock_status`](/mcp/system/#sendmock_status)

### 253. SMTP

Heading.

- **What it does:** The SMTP snippet for the chosen language.

### 254. Copy SMTP snippet

Button.

- **What it does:** Copies the snippet.

### 255. Email API

Heading.

- **What it does:** The Email API snippet for the chosen language.

### 256. Copy Email API snippet

Button.

- **What it does:** Copies the snippet.

### 257. SMS API

Heading.

- **What it does:** The SMS API snippet for the chosen language.

### 258. Copy SMS API snippet

Button.

- **What it does:** Copies the snippet.

### 259. HTTP Catcher (point Slack, push or other webhooks here)

Heading.

- **What it does:** The HTTP Catcher (point Slack, push or other webhooks here) snippet for the chosen language.

### 260. Copy HTTP Catcher (point Slack, push or other webhooks here) snippet

Button.

- **What it does:** Copies the snippet.

### 261. Provider APIs

Heading.

- **What it does:** Base URLs to give the providers' SDKs.

### 262. Point a provider's SDK at SendMock: use this base URL, or the real path on the provider port (#.#.#.#:#). Change, remove or add providers in Mail > Providers and SMS > Providers.

Text.

- **What it does:** Explains the base URLs and the provider port.

### 263. Email

Heading.

- **What it does:** The email providers' base URLs.

### 264. …

Link, in each row.

- **What it does:** A provider's name; opens it in Mail > Providers or SMS > Providers.

### 265. Copy the … base URL

Button, in each row.

- **What it does:** Copies the provider's base URL.

### 266. SMS

Heading.

- **What it does:** The SMS providers' base URLs.

### 267. AI agents

Heading.

- **What it does:** Setting up an AI coding agent.
- **Links to:** [AI](../ai/index.md).

### 268. Let Claude Code, Codex, Cursor, Gemini CLI or VS Code drive SendMock through MCP and the agent skill.

Text.

- **What it does:** Explains the section.

### 269. AI agent

Drop-down.

- **What it does:** The agent to set up.
- **Same action elsewhere:** REST [`GET /api/v1/ai/agents`](/api/automation/#getAiAgents), CLI [`sendmock ai install`](/cli/automation/#ai-install), MCP [`sendmock_ai_agents`](/mcp/automation/#sendmock_ai_agents)

### 270. Installed

Choice.

- **What it does:** Shows the commands for an installed SendMock: the agent starts `sendmock mcp`.

### 271. npx (no install)

Choice.

- **What it does:** Shows the commands for SendMock run through npx with nothing installed: the agent starts `npx -y sendmock mcp`, and the install command is `npx sendmock ai install`, which writes that form by itself.

### 272. Install command

Heading.

- **What it does:** The command that sets the agent up.

### 273. Copy install command

Button.

- **What it does:** Copies `sendmock ai install` for the chosen agent.

### 274. MCP configuration

Heading.

- **What it does:** The MCP configuration, to add by hand instead.

### 275. Copy mcp configuration

Button.

- **What it does:** Copies the MCP configuration.

### 276. The install command writes the configuration to claude mcp add sendmock -- sendmock mcp and the skill to .claude/skills/sendmock/ , after showing what it will change.

Text.

- **What it does:** Says what the install command writes for the chosen agent (here Claude Code).

### 277. Download the skill

Link.

- **What it does:** Downloads the agent skill.
- **Same action elsewhere:** REST [`GET /api/v1/ai/skill`](/api/automation/#getAiSkill), CLI [`sendmock ai skill`](/cli/automation/#ai-skill)

## About section

### 278. About SendMock

Heading.

- **What it does:** The version and channel of the running SendMock.
- **Same action elsewhere:** REST [`GET /api/v1/info`](/api/system/#getInfo), CLI [`sendmock status`](/cli/system/#status), MCP [`sendmock_status`](/mcp/system/#sendmock_status)

### 279. Help and feedback

Heading.

- **What it does:** The help links, as in the Help menu.

### 280. Issue forms open on GitHub with your version, channel, OS and browser filled in; nothing you captured is sent.

Text.

- **What it does:** Explains what the issue forms carry.

### 281. Documentation

Link.

- **What it does:** Opens the docs in a new tab.

### 282. Keyboard shortcuts

Button.

- **What it does:** Opens the list of keyboard shortcuts.

### 283. What's new

Link.

- **What it does:** Opens the changelog.

### 284. Report an issue

Link.

- **What it does:** Opens GitHub's bug report form, filled in.

### 285. Request a feature

Link.

- **What it does:** Opens GitHub's feature request form, filled in.

### 286. Report a security issue

Link.

- **What it does:** Opens GitHub's private security report form.

### 287. Star on GitHub

Link.

- **What it does:** Opens the repository.

### 288. Updates

Heading.

- **What it does:** Whether SendMock looks for new releases.

### 289. Off by default: SendMock never calls out unless you choose Manual or Daily. Stable installs are offered stable releases; beta installs betas and stables.

Text.

- **What it does:** Explains the update check.

### 290. Off SendMock never calls out.

Choice.

- **What it does:** Never checks.

### 291. Manual Only when you press Check for updates.

Choice.

- **What it does:** Checks only when you ask.

### 292. Daily On start and once a day; a new version shows in the notifications.

Choice.

- **What it does:** Checks on start and once a day.

### 293. Check for updates

Button.

- **What it does:** Looks for a newer release now and shows how to upgrade.
- **Same action elsewhere:** REST [`GET /api/v1/updates`](/api/system/#getUpdates), CLI [`sendmock update check`](/cli/system/#update-check), MCP [`sendmock_update_check`](/mcp/system/#sendmock_update_check)

## AI agents through npx

### 294. Nothing to install: the agent starts SendMock with npx -y sendmock mcp , which needs Node.js. On Windows, if the agent cannot start npx, use cmd /c npx -y sendmock mcp .

Text.

- **What it does:** Explains the npx form and the Windows workaround.
- **Links to:** [Install: npx (no install)](../install.md#npx-no-install).

### 295. The install command writes the configuration to claude mcp add sendmock -- npx -y sendmock mcp and the skill to .claude/skills/sendmock/ , after showing what it will change.

Text.

- **What it does:** Says what the install command writes for the chosen agent through npx (here Claude Code).

## Delete all emails dialog

### 296. Delete all emails?

Heading.

- **What it does:** The confirmation before deleting every email.

### 297. Every captured email, its attachments and its SMTP session link are removed. Configuration stays.

Text.

- **What it does:** Says what is deleted.

### 298. Cancel

Button.

- **What it does:** Closes the confirmation without doing anything.

### 299. Delete all emails

Button.

- **What it does:** Deletes every email.
- **Same action elsewhere:** REST [`DELETE /api/v1/emails`](/api/email/#deleteEmails), CLI [`sendmock email delete-all`](/cli/email/#email-delete-all), MCP [`sendmock_email_delete_all`](/mcp/email/#sendmock_email_delete_all)

## Delete all SMS dialog

### 300. Delete all SMS?

Heading.

- **What it does:** The confirmation before deleting every SMS.

### 301. Every captured SMS and WhatsApp message is removed. Numbers and services stay.

Text.

- **What it does:** Says what is deleted.

### 302. Cancel

Button.

- **What it does:** Closes the confirmation without doing anything.

### 303. Delete all SMS

Button.

- **What it does:** Deletes every SMS.
- **Same action elsewhere:** REST [`DELETE /api/v1/sms`](/api/sms/#deleteSms), CLI [`sendmock sms delete-all`](/cli/sms/#sms-delete-all), MCP [`sendmock_sms_delete_all`](/mcp/sms/#sendmock_sms_delete_all)

## Reset to seed dialog

### 304. Reset to seed?

Heading.

- **What it does:** The confirmation before a reset.

### 305. All traffic is wiped and the configuration goes back to the seed file. Changes not exported to the seed are lost.

Text.

- **What it does:** Says what a reset does.

### 306. Cancel

Button.

- **What it does:** Closes the confirmation without doing anything.

### 307. Reset

Button.

- **What it does:** Resets to the seed file.
- **Same action elsewhere:** REST [`POST /api/v1/reset`](/api/system/#postReset), CLI [`sendmock reset`](/cli/system/#reset), MCP [`sendmock_reset`](/mcp/system/#sendmock_reset)

## When the data cannot load

### 308. Could not load the settings. Try again

Message.

- **What it does:** Shown when the settings could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 309. Could not load the settings.

Text.

- **What it does:** The message inside the alert.

### 310. Try again

Button.

- **What it does:** Loads the settings again.
- **Same action elsewhere:** REST [`GET /api/v1/settings`](/api/system/#getSettings), CLI [`sendmock settings get`](/cli/system/#settings-get), MCP [`sendmock_settings_get`](/mcp/system/#sendmock_settings_get)
