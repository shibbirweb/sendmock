# 23. Promotional video

A short promotional trailer that shows what SendMock does: it catches what your app sends (email, SMS, payments, any API call) and answers with the real provider's webhooks, ships the providers, templates and events built in, lets you build the ones it does not ship, is ready for AI agents, and runs on every platform.

Where it is shown on the website (the landing page's video section above the footer, the poster and the play button) is planned in [16](16-website-and-releases.md#landing-page-with-magic-ui); acceptance criterion WS-02.4 in [07-distribution-website](acceptance/07-distribution-website.md).

## Decisions (2026-10-27, updated 2026-10-29)

| Item | Decision |
|------|----------|
| Goal | someone who has never heard of SendMock (a developer, or a person building an app with an AI coding agent) sees what it does in under two minutes and installs it, opens the demo or asks their agent to set it up |
| Audience | **developers** (backend and full-stack developers and QA engineers) who send email, SMS, payments or webhooks from their app, and **vibe coders**, people who build apps by describing them to an AI coding agent |
| Length | about 110 seconds (owner brief 2026-10-29 lists eight subjects); a short cut for social media and the README comes from the same film later |
| Story | the eleven scenes in [Trailer (2026-10-29)](#trailer-2026-10-29) below. All earlier films and act plans were cleared on 2026-10-29 at the owner's request |
| Claims | only what SendMock does, with its real names: provider names, template ids, event names and MCP tool names come from the app's own data. No invented numbers |
| Production | motion graphics built in Remotion (`video/`), with SendMock's UI parts drawn from the app's dark theme and real data, so every scene can move: requests travel, events fire, prompts type |
| Sound | no voice-over: the film tells its story in on-screen words and works muted. Copyright-free generated music is added once the picture is approved |
| Captions | English WebVTT captions burned into the social cut and as a track on the full video, so it works muted |
| Hosting | YouTube (public); the landing page loads the player only after the play button is pressed (`youtube-nocookie.com`), so the page stays fast and sets no third-party cookies before that |
| Before the video exists | the landing section shows the poster, a disabled play button with "Video coming soon" and the three benefit points |
| Where | the landing page (the section above the footer), the README and social posts for releases |
| Refresh | when the product's story changes (for example payments or AI agents grow), at the latest for 1.0 |

## Trailer (2026-10-29)

Owner brief: a promotional trailer that shows the main features (webhooks for email, SMS, payments and any API call) in an interactive way; the built-in provider templates in an animated bento; the built-in webhook events animated on screen; that you can build your own webhook templates, email providers, SMS providers and payment gateways; that everything is AI ready, with example prompts in an AI agent; and that it runs on every platform.

### What the research showed

- **Show the process, not a still screen.** Developers trust the real workflow (the request, the call, the log). Motion graphics earn their place when they show a process, so each feature scene shows the cause in SendMock, the webhook travelling, and your app's log receiving it.
- **Bento grids move per tile.** Polished bento reveals stagger the tiles to lead the eye in reading order, give each tile its own small motion (a counter, names rising in, a value cycling) and keep one corner radius and one padding across tiles.
- **AI agents: the prompt, then the tool calls.** The typed request is shown as the hero, and the agent's work as a short list of readable tool-call cards with their real names, ending on a one-line answer. The agent supports the product; it does not replace it.
- **Short and clear.** One message per scene, one headline of at most eight words, a clear call to action at the end.

### Look and feel

| Element | Decision |
|---------|----------|
| Canvas | GitHub's dark background `#0d1117` with two soft teal and emerald glows drifting slowly, fine grain; surfaces `#161b22` with `#30363d` borders; words off-white `#e6edf3`, supporting words at about 62 percent; one calm mint accent `#7ccfbd` |
| Type | Geist for words, a monospace font for requests, logs, tool names and commands. Each scene has a small chapter label (for example `01 · Email`) and one headline at the top |
| Motif | a dashed mint line between SendMock and your app. A webhook travels along it as a soft dot of light and the request card shows what was sent, in the provider's own format |
| Motion | elements rise in through a small blur over about half a second, no overshoot; scenes change with short crossfades (about half a second); the canvas always drifts. No ripples, rings, expanding circles or thin arcs: a press or an arrival shows as a soft bloom of light. Respects the brand colours of each provider only as a small dot |

### The scenes

| # | Scene | Headline | What moves | About |
|---|-------|----------|------------|-------|
| 1 | Open | big words, one at a time: **Email. SMS. Payments. Any API.**, then **Every webhook, on localhost.** and the SendMock logo | words land on the beat, each channel with a small icon | 7 s |
| 2 | Email | "Every email event, back to your app." | the order email in SendMock's inbox; Delivered, Opened and the customer's reply light up one after another; each sends a SendGrid-format request (Event Webhook, then Inbound Parse) along the line; your app logs `200` | 11 s |
| 3 | SMS | "Texts, receipts and replies, like Twilio." | the "Reply YES" text in the thread; its ticks turn delivered (status callback); the customer replies YES (inbound SMS with `X-Twilio-Signature`); your app answers with TwiML and the answer appears in the thread | 11 s |
| 4 | Payments | "Checkouts that pay, decline and refund." | the test checkout (Stripe, $42.00) with its test controls (Pay successfully, Decline, Require 3-D Secure, Refund); Pay successfully is pressed and the order turns Paid (`checkout.session.completed`), then Refund turns it Refunded (`charge.refunded`); each Stripe-format event carries `Stripe-Signature` | 10 s |
| 5 | Any API | "Any other API call, caught." | the direction flips: your app posts to Slack, Discord and a CRM API, and the HTTP catcher catches each call, answers it and previews the message | 9 s |
| 6 | Built in | "Built in. Ready on first run." | a bento of tiles: 6 email providers, 6 SMS providers, 5 payment gateways, 17 webhook templates (each tile counts up and its names rise in), plus "Signed like the real thing" and "Real responses and errors" | 11 s |
| 7 | Events | "32 events. Subscribe to any." | every built-in event as a chip, grouped by area (email, SMS, verify, HTTP, payment, checkout, webhook, test), cascading in by column, then events firing live across the wall | 9 s |
| 8 | Build your own | "Missing one? Build it." | four builders at work: a webhook template being typed with its live preview, a new email provider from blank, an SMS provider from a built-in, a payment gateway's checkout flow getting its steps (wallet number, OTP, PIN) | 11 s |
| 9 | AI ready | "AI ready. Everything, by prompt." | an AI agent window: three prompts typed one after another, each followed by the SendMock tool calls it makes and a one-line answer; then the agents it sets up (Claude Code, Codex, Cursor, Gemini CLI, VS Code) and `sendmock ai install` | 19 s |
| 10 | Everywhere | "Runs everywhere you build." | four tiles (macOS, Linux, Windows, Docker) with their architectures, the install command cycling through Homebrew, the install script, WinGet, Scoop and Docker, and the languages with examples (PHP, Node, Python, Go, Java, Rust, Ruby, .NET) | 10 s |
| 11 | Close | "Your app talks. SendMock talks back." | the logo and name, the install command, the website (`https://shibbirweb.github.io/sendmock/`, shown as `shibbirweb.github.io/sendmock`), `github.com/shibbirweb/sendmock`, and one line of facts: open source, runs on your machine | 7 s |

The example prompts in scene 9:

| Prompt | Tool calls shown | Answer |
|--------|------------------|--------|
| "Add Upay as a payment gateway: wallet number, OTP, then PIN." | `sendmock_payment_flow_create`, `sendmock_payment_flow_step_add` (3 steps), `sendmock_payment_gateway_create`, `sendmock_payment_gateway_preview` | "Upay is ready: 3 steps, and the checkout preview passes." |
| "Test the signup: get the OTP from the SMS." | `sendmock_sms_list`, `sendmock_otp_get` | "Code 482913, sent to +1 202 555 0100. Signup verified." |
| "Send bounced emails to my app in SendGrid's format, then test it." | `sendmock_webhook_endpoint_create`, `sendmock_outcome_rule_create`, `sendmock_email_send_test`, `sendmock_webhook_delivery_wait` | "email.bounced reached your app in SendGrid's format: 200 OK." |

### Where it lives

The `SendMockTrailer` composition in `video/src/trailer/`: one file per scene in `scenes/`, shared parts (backdrop, window, headline, flow line, request card, terminal) in `parts/`, and the product facts (providers, templates, events, agents, platforms, copied from the app's mock data and plans) in `trailer-facts.ts`. Preview in Remotion Studio (`bun run studio` in `video/`); an MP4 is rendered only once the owner approves.

### Version with an app tour (`SendMockTrailerTour`, 2026-10-29)

Owner request: a copy of the trailer that, after the AI prompts, shows some of the app's pages at a glance. `SendMockTrailer` stays as it is; `SendMockTrailerTour` plays the same scenes with one more after scene 8:

| # | Scene | Headline | What moves | About |
|---|-------|----------|------------|-------|
| 9 | At a glance | "One app for all of it." | real screenshots of eight SendMock pages in the dark theme, one after another inside one window whose title shows the page's address (`localhost:8025/...`): Overview, Mail, SMS, Webhook deliveries, Webhook templates, Payments, HTTP catcher, Scenarios. Each page slides in from the right, fully opaque, while the last one eases left and dims (two screens never show through each other), then pushes in slowly; a list of the page names beside the window lights the current one | 13 s |

Platforms becomes `10 · Everywhere` in this version. The screenshots are taken from the web app in mock mode (`bun run dev` in `web/`, then `bun run app-pages` in `video/`), at 1440 by 900 and twice the pixel density, with the demo controls hidden, into `video/public/app-pages/`.

### Music (2026-10-29)

Owner request: unique, copyright-free music that suits a developer-tool introduction, playable in Remotion Studio.

**How it is made:** composed in code. A small synthesizer script (`bun run music` in `video/`, sources in `video/scripts/music/`) writes an original track for each composition from oscillators and noise, with no samples, loops or third-party recordings, so SendMock owns it outright and no licence is needed. The script reads the trailer's own scene list, so every section change and hit lands on a cut, and it is re-run whenever scene lengths change. Output: `video/public/music/sendmock-trailer.mp3` and `sendmock-trailer-tour.mp3` (192 kbps), played by each composition.

**What the research showed** (launch and tech-video music): about 110 to 120 BPM, uplifting and medium-driving; plucked synth arpeggios, warm pads and a steady electronic pulse; different energy per part with one continuous theme; a riser into each reveal; the biggest lift on the product moment; quiet enough to read on-screen words over it.

| Item | Decision |
|------|----------|
| Tempo and key | 120 BPM, so one beat is exactly 15 frames at 30 fps; A minor, the loop Am9, Fmaj7, Cadd9, G6 (one chord per bar), resolving to C major at the end |
| Palette | plucked saw arpeggio in sixteenths with a ping-pong delay, warm detuned pad, sub bass, soft kick, hats and claps, a riser and a low impact for reveals, small bells for events; one shared reverb |
| Opening | a soft hit on each word (Email, SMS, Payments, Any API), a riser under "Every webhook, on localhost." and an impact with the pad swelling as the logo lands |
| Feature scenes (email to any API) | groove: kick on beats 1 and 3, off-beat hats, pumping bass, the arpeggio at medium brightness |
| Built in, events | lift: four-on-the-floor, claps on 2 and 4, brighter arpeggio; bells sparkle while the events fire |
| Build your own | back to the groove |
| AI ready | breakdown: drums out, pad and a darker, sparser arpeggio, then a riser into the next scene |
| At a glance (tour) and platforms | the drop: every layer at full brightness plus a short lead melody (in the version without the tour, platforms takes the drop) |
| Close | an impact on the closing line, the pad resolving to C major, the arpeggio thinning out, a long fade |
| Mix | drums duck the music slightly on each kick (sidechain); a soft limiter keeps peaks under -1 dBFS; the music stays under the picture, no voice-over to leave room for |
