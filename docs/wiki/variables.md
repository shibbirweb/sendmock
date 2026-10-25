---
title: Variables
description: Values templates read as vars.name, global or per endpoint.
---

> **The screen is in the [live demo](/demo/webhooks/variables). Server-side resolution arrives in Phase 3.**

Templates read variables as `{{ vars.name }}`. A variable on an endpoint overrides a global one of the same name.

| Kind | Value |
| --- | --- |
| Text, Number, Boolean, JSON | a fixed value |
| Secret | a fixed value, masked everywhere and never exported in plain text |
| Dynamic | an expression over the message, for example `data.to[0].address \| lower` |
| Random | a new value per send, or generated once until you regenerate it |
| Computed | a template made of other variables |
| Prompt | asked for on each manual send |
