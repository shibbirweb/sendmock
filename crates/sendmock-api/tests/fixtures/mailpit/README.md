# Mailpit API definitions

`mailpit-definitions.json` holds the response shapes of Mailpit's REST API, trimmed from Mailpit's own `server/ui/api/v1/swagger.json` at tag `v1.33.0` (https://github.com/axllent/mailpit). `mailpit_api.rs` checks every answer of SendMock's Mailpit compatibility routes against them (EM-19.5).

Mailpit is copyright Ralph Slooten and released under the MIT License, included as `LICENSE-mailpit`.
