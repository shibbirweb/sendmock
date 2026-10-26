---
title: Advanced
description: Customize the built-in features and create your own gateways, methods, flows, templates, rules, routes and outcomes.
---

The [recipes](../recipes/index.md) use what SendMock ships. These pages show how to change it, and how to create what it does not ship. Each one has the steps in the UI, the same in the seed file or CLI, how to undo, and what still needs code.

Everything here can also be done by an AI agent: see [Build it with AI](../ai/build-with-ai.md).

## Payments

| Page | Create or change |
| --- | --- |
| [Create a payment gateway](./payment-gateway.md) | a complete gateway SendMock does not ship, from its docs to a working checkout, redirect and notification |
| [Create a payment method](./payment-method.md) | a wallet, bank or card method with its own test values |
| [Create a payment flow](./payment-flow.md) | the steps a checkout asks for, with your own labels |

## Webhooks

| Page | Create or change |
| --- | --- |
| [Create and edit templates](./templates.md) | the shape of a request: edit a built-in, clone, write your own, share with your team |
| [Request editor](./request-editor.md) | body modes, Strict or Lenient rendering, custom signatures |
| [Variables in depth](./variables.md) | values from the message, random values, computed values, prompts, secrets |
| [Rules and filters](./rules-and-filters.md) | exact filters with groups, not, headers and regex |
| [Inbound routes in depth](./inbound-routes.md) | reply routing by ticket, store and notify, Mailgun's Routes API |

## Capture

| Page | Create or change |
| --- | --- |
| [Catcher responses](./catcher-responses.md) | how a bin answers: rules by path, templated bodies, delays, failure rates |
| [Email outcome addresses](./email-outcome-addresses.md) | your own addresses that bounce, defer, complain or are rejected |
| [SMS outcome numbers](./sms-outcome-numbers.md) | your own numbers that fail, arrive late or are read |
| [OTP patterns](./otp-patterns.md) | your app's code format |
| [Numbers and Messaging Services](./numbers-and-services.md) | reply webhooks, fallbacks and sender pools |
| [Chaos](./chaos.md) | SMTP rejections, latency and dropped connections |

## Sharing and automation

| Page | Create or change |
| --- | --- |
| [Seed file](./seed-file.md) | your setup as a file in your repository, for your team and CI |
| [Scenarios](./scenarios.md) | multi-step tests you write once and run again |

## What still needs code

Almost everything is data you can change. A few things need a change to SendMock itself: a new **checkout step type**, a new **HTTP Catcher preset**, and a provider's **API calls** beyond what a gateway or provider emulation already answers. Ask for them with a provider request issue (Help menu > **Request a feature**).
