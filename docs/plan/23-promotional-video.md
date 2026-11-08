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
| Sound | no voice-over and no music (owner direction 2026-10-29): the film tells its story in on-screen words and works muted, and each change in the picture makes a short synthesized sound effect (see [Sound effects](#sound-effects-2026-10-29)) |
| Captions | none (changed 2026-10-30, owner decision): the trailer has no voice-over and every word is on screen, so it works muted without a captions track |
| Hosting | YouTube (public); the landing page loads the player only after the play button is pressed (`youtube-nocookie.com`), so the page stays fast and sets no third-party cookies before that |
| Before the video exists | the landing section showed the poster, a disabled play button with "Video coming soon" and the three benefit points, until the video was published on 2026-10-30 |
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
| Motion | elements rise in through a small blur over about half a second, no overshoot; scenes change without overlap through pushes, zoom-throughs and one match cut (see [Transitions and motion](#transitions-and-motion-2026-10-29)); the canvas always drifts. No ripples, rings, expanding circles or thin arcs: a press or an arrival shows as a soft bloom of light. Respects the brand colours of each provider only as a small dot |

### The scenes

| # | Scene | Headline | What moves | About |
|---|-------|----------|------------|-------|
| 1 | Open | big words, one at a time: **Email. SMS. Payments. Any API.**, then **Every webhook, on localhost.** and the SendMock logo | words land on the beat, each channel with a small icon | 7 s |
| 2 | Email | "Every email event, back to your app." | the order email in SendMock's inbox; Delivered, Opened and the customer's reply light up one after another; each sends a SendGrid-format request (Event Webhook, then Inbound Parse) along the line; your app logs `200` | 11 s |
| 3 | SMS | "Texts, receipts and replies, like Twilio." | the "Reply YES" text in the thread; its ticks turn delivered (status callback); the customer replies YES (inbound SMS with `X-Twilio-Signature`); your app answers with TwiML and the answer appears in the thread | 11 s |
| 4 | Payments | "Checkouts that pay, decline and refund." | the test checkout (Stripe, $42.00) with its test controls (Pay successfully, Decline, Require 3-D Secure, Refund); Decline is pressed and the order turns Declined (`payment_intent.payment_failed`, `card_declined`), then Pay successfully turns it Paid (`checkout.session.completed`), then Refund turns it Refunded (`charge.refunded`); each Stripe-format event carries `Stripe-Signature` | 10 s |
| 5 | Any API | "Any other API call, caught." | the direction flips: your app posts to Slack, Discord and a CRM API, and the HTTP catcher catches each call, answers it and previews the message | 9 s |
| 6 | Built in | "Built in. Ready on first run." | a bento of tiles: 6 email providers, 6 SMS providers, 5 payment gateways, 17 webhook templates (each tile counts up and its names rise in, then a dashed "+ Custom" chip shows you can add your own), plus "Signed like the real thing" and "Real responses and errors" | 11 s |
| 7 | Events | "32 events. Subscribe to any." | every built-in event as a chip, grouped by area (email, SMS, verify, HTTP, payment, checkout, webhook, test), cascading in by column, then events firing live across the wall | 9 s |
| 8 | Build your own | "Missing one? Build it." | four builders at work: a webhook template being typed with its live preview, a new email provider from blank, an SMS provider from a built-in, a payment gateway's checkout flow getting its steps (wallet number, OTP, PIN) | 11 s |
| 9 | AI ready | "AI ready. Everything, by prompt." | an AI agent window: three prompts typed one after another, each followed by the SendMock tool calls it makes and a one-line answer; then the agents it sets up (Claude Code, Codex, Cursor, Gemini CLI, VS Code) and `sendmock ai install` | 19 s |
| 10 | Everywhere | "Runs everywhere you build." | four tiles (macOS, Linux, Windows, Docker) with their architectures, the stable install commands exactly as the docs Install page gives them, each shown once: Homebrew, the install script (macOS and Linux), the PowerShell install script (Windows), then Docker, which stays until the cut; under it "No SDK needed" with the ways an app connects (SMTP, REST API, Provider APIs, Webhooks, CLI, MCP) | 10 s |
| 11 | Close | "Your app talks. SendMock talks back." | the logo and name, the install bar carrying the Docker command across the cut and turning into the platforms (Windows, macOS, Linux, Docker), the website (`https://shibbirweb.github.io/sendmock/`, shown as `shibbirweb.github.io/sendmock`), `github.com/shibbirweb/sendmock`, and one line of facts: open source, runs on your machine | 7 s |

The example prompts in scene 9:

| Prompt | Tool calls shown | Answer |
|--------|------------------|--------|
| "Add Upay as a payment gateway: wallet number, OTP, then PIN." | `sendmock_payment_flow_create`, `sendmock_payment_flow_step_add` (3 steps), `sendmock_payment_gateway_create`, `sendmock_payment_gateway_preview` | "Upay is ready: 3 steps, and the checkout preview passes." |
| "Test the signup: get the OTP from the SMS." | `sendmock_sms_list`, `sendmock_otp_get` | "Code 482913, sent to +1 202 555 0100. Signup verified." |
| "Send bounced emails to my app in SendGrid's format, then test it." | `sendmock_webhook_endpoint_create`, `sendmock_outcome_rule_create`, `sendmock_email_send_test`, `sendmock_webhook_delivery_wait` | "email.bounced reached your app in SendGrid's format: 200 OK." |

### Where it lives

One composition, `SendMockTrailerMechanicalTyping`, in `video/src/trailer/` (see [One film](#one-film-2026-10-29) and [Mechanical typing](#mechanical-typing-sendmocktrailermechanicaltyping-2026-10-29)): one file per scene in `scenes/`, shared parts (backdrop, window, headline, flow line, request card, terminal) in `parts/`, and the product facts (providers, templates, events, agents, platforms, copied from the app's mock data and plans) in `trailer-facts.ts`. Preview in Remotion Studio (`bun run studio` in `video/`); an MP4 is rendered only once the owner approves.

### Version with an app tour (`SendMockTrailerTour`, 2026-10-29)

Owner request: a copy of the trailer that, after the AI prompts, shows some of the app's pages at a glance. `SendMockTrailer` stays as it is; `SendMockTrailerTour` plays the same scenes with one more after scene 8:

| # | Scene | Headline | What moves | About |
|---|-------|----------|------------|-------|
| 9 | At a glance | "One app for all of it." | real screenshots of eight SendMock pages in the dark theme, one after another inside one window whose title shows the page's address (`localhost:8025/...`): Overview, Mail, SMS, Webhook deliveries, Webhook templates, Payments, HTTP catcher, Scenarios. Each page slides in from the right, fully opaque, while the last one eases left and dims (two screens never show through each other), then pushes in slowly; a list of the page names beside the window lights the current one | 13 s |

Platforms becomes `10 · Everywhere` in this version. The screenshots are taken from the web app in mock mode (`bun run dev` in `web/`, then `bun run app-pages` in `video/`), at 1440 by 900 and twice the pixel density, with the demo controls hidden, into `video/public/app-pages/`.

### Version with every platform at the close (`SendMockTrailerTourPlatforms`, 2026-10-29)

Owner request: a copy of the tour version whose closing card shows that SendMock runs on Windows, macOS, Linux and Docker instead of only the Homebrew command. In the copy, the install bar still carries over from the platforms scene (the match cut); while it settles, the Homebrew command fades out and the four platforms fade in, each with the icon its tile has in the platforms scene.

### Version with the ways to connect (`SendMockTrailerTourConnections`, 2026-10-29)

Owner request: SendMock needs no SDK and no particular language, so the language names under the install bar read as if SendMock depended on them. A copy of the platforms version replaces "Any language" and the eight language names with "No SDK needed" and the ways an app talks to SendMock: SMTP (any mail library), REST API (SendMock's own), Provider APIs (the official provider SDKs with the base URL swapped), Webhooks (plain HTTP to your app), CLI and MCP. Everything else is the platforms version.

### One film (2026-10-29)

Owner decision: keep only the last cut. `SendMockTrailer`, `SendMockTrailerTour` and `SendMockTrailerTourPlatforms` are removed, and `SendMockTrailerTourConnections` is the trailer: the eleven scenes, the app tour after the AI prompts, the ways to connect in the platforms scene and every platform on the closing card. The sections above record how it got there.

### Mechanical typing (`SendMockTrailerMechanicalTyping`, 2026-10-29)

Owner request: a copy of the trailer whose typing sounds like a real mechanical keyboard. The picture, the cues and every other sound are the same as `SendMockTrailerTourConnections`; only the key sound changes. Owner decision the same day: keep only this copy. `SendMockTrailerTourConnections` and the four soft key sounds are removed, so `SendMockTrailerMechanicalTyping` is the trailer and mechanical keys are its only typing sound.

- **One key is a press and a release.** A mechanical key is several sounds, not one click: the switch clicks (a short resonant tick near 3.3 to 4 kHz), about 10 ms later the keycap bottoms out on the plate (a knock near 1.5 kHz) and the case rings low for a moment (the "thock", near 300 Hz), then 80 to 105 ms after the press the key springs back with a quieter click. Each `mechanical-key-*.wav` holds the whole press and release.
- **Six keys.** Six keys with slightly different pitches, bottom-out times and release loudness (`video/scripts/sounds/mechanical-key-voice.ts`) take turns in an uneven pattern, and the press volume varies a little, so fast typing never repeats one sample.
- **Still soft.** Everything above 7 kHz is rolled off, so the clicks stay crisp without being sharp. Typing keeps the same cue timing as the soft version (one press per character, at most 15 a second).

### Frame rate and render (2026-10-29)

Owner request: render for YouTube in 4K at 60 fps.

- **Design frames.** Every timing in the trailer is written in design frames, 30 to a second (`designFps` in `video/src/brand.ts`), as reviewed in Studio. The video runs at 60 fps (`videoFps`). Scenes read the time with `useDesignFrame()` (`video/src/trailer/trailer-time.ts`), which gives the design frame with fractions between frames, so every animation moves on each of the 60 frames a second; only the places that hand frame counts to Remotion (compositions, scene and transition lengths, sequences, sounds) convert with `toVideoFrames()`. A change to the frame rate is a change to `videoFps` alone.
- **4K.** The compositions stay 1920 by 1080; the render doubles them (`--scale=2`) to 3840 by 2160, so text and shapes are drawn at full 4K sharpness. The app screenshots are 2880 by 1800, sharp enough at that size.
- **Render** (in `video/`, `out/` is ignored):

  ```bash
  bunx remotion render src/index.ts SendMockTrailerMechanicalTyping out/sendmock-trailer-4k60.mp4 --scale=2 --codec=h264 --crf=18
  ```

### YouTube upload (2026-10-29)

Owner request: everything needed to publish the trailer on YouTube.

- **Thumbnail:** the still `SendMockYoutubeThumbnail` (`video/src/thumbnail/youtube-thumbnail.tsx`, 1280 by 720): the logo, "Every webhook. On localhost." in big words, chips for Email, SMS, Payments and Any API, the line "Open source · No SDK needed · AI ready", and the real webhook deliveries page on the right. Render it in `video/`:

  ```bash
  bunx remotion still src/index.ts SendMockYoutubeThumbnail out/sendmock-youtube-thumbnail.jpg --image-format=jpeg --jpeg-quality=92
  ```

- **Title:** "SendMock: Test Email, SMS & Payment Webhooks on Localhost".
- **Category:** Science & Technology. Not made for kids, no paid promotion, no altered or synthetic content to declare (motion graphics only).
- **Chapters** (each at least 10 seconds, as YouTube requires): 0:00 Email webhooks, 0:17 SMS, 0:27 Payments and any API, 0:45 Built in, 0:55 Events and build your own, 1:14 AI ready, 1:32 App tour, 1:44 Install anywhere.
- **Timing:** the install commands in the film only work once the first release is published, so the video goes public after `0.1.0-beta.1` (or the description says the first beta is coming).
- **Published** 2026-10-30: https://youtu.be/OHR7pVFGTl4. The landing page's play button loads it from `youtube-nocookie.com` in place of the poster (`website/components/landing/promo-video-player.tsx`).

### GitHub social preview (2026-10-30)

Owner request: a social preview image for the GitHub repository, the picture shown when the repository link is shared. The still `SendMockGithubSocialPreview` (`video/src/thumbnail/github-social-preview.tsx`, 1280 by 640, GitHub's recommended size) matches the YouTube thumbnail: the logo, "Every webhook. On localhost.", "One local server to test email, SMS and payments.", the channel chips (shared with the thumbnail in `channel-chips.tsx`), `github.com/shibbirweb/sendmock` with "Open source · macOS · Linux · Windows · Docker", and the webhook deliveries page on the right. Text keeps a 72 px margin, inside the area sites may crop.

1. Render it in `video/`:

   ```bash
   bunx remotion still src/index.ts SendMockGithubSocialPreview out/sendmock-github-social-preview.png
   ```

2. Upload it on GitHub: the repository's **Settings**, **General**, **Social preview**, **Edit**, **Upload an image**. The file is about 410 KB, under GitHub's 1 MB limit.

### Sound effects (2026-10-29)

Owner direction: no background music. Instead, every change in the picture makes its own short sound: a click when a control is pressed, a swoosh when data is sent, a soft blip when it lands, a success chime or a gentle error tone for the outcome, typing while text is typed, a pop when something appears, a swipe for each page of the app tour, a whoosh for each scene transition and a soft reveal for the logo and the closing line. The earlier composed music (`bun run music`) was removed.

| Item | Decision |
|------|----------|
| How they are made | synthesized in code (`bun run sounds` in `video/`, sources in `video/scripts/sounds/`) from oscillators and filtered noise, with no samples or recordings, so no licence is needed; written to `video/public/sounds/*.wav` |
| Sync | each scene lists its sound cues from the same constants that drive its animation (step frames, typing speeds, tile and page timings), and the trailer plays them inside that scene's sequence, so a timing change moves the sound with the picture without regenerating anything |
| Character | soft and rounded so a two-minute watch never tires the ear: pitched in a calm major key, gentle attacks, only warm octave overtones (no metallic bell partials), nothing above the middle of the piano; outcomes (success, error) a little more forward than the rest |
| Typing (owner review 2026-10-29) | one key press for every character as it appears on screen, timed from the same typing speed the text uses (the email reply, Maya's YES, every builder field and template, every AI prompt); fast typing is capped at 15 presses a second; the keys are mechanical keyboard keys (see [Mechanical typing](#mechanical-typing-sendmocktrailermechanicaltyping-2026-10-29)) |
| Repeated sounds (owner review 2026-10-29) | a high bell on the events wall was disturbing, so the event sound is now a soft low note (G4 to E5, slow attack, pure tone) that takes turns on five notes in a gentle pattern instead of repeating one, plays for every third live event only, and sits quietest in the mix; the same sound is used for tool-call checks and install commands |
| Data transfer | in the feature scenes each request leaves with a swoosh; a webhook that reaches your app with `200` lands with a success chime; in payments the order's status answers at once (an error tone for the decline, a chime for paid and refunded) and each Stripe event lands with a blip; in the HTTP catcher each call is caught with a blip and SendMock's answer returns with a chime |

### Transitions and motion (2026-10-29)

Owner review: the crossfade between scenes put two busy layouts on top of each other (the logo over the email scene), and the motion should feel more professional and engaging, with elements that move and transform.

**What the research showed** (motion-design transitions, launch videos): crossfading between scenes is the classic anti-pattern; the way a scene exits decides how the next one enters (same axis, same direction, matched speed, cut in the middle of the motion); use a small set of transition types consistently, plus one shared-element match cut for the key moment; directional moves with speed ramps give a video energy; a dynamic zoom takes the viewer deeper into the product.

| Element | Decision |
|---------|----------|
| No overlap | scenes never crossfade. In every transition the outgoing scene leaves before or as the incoming one arrives, so two layouts never sit on top of each other |
| Push (series) | between the feature chapters (email, SMS, payments, any API) the camera pans left: the outgoing scene is pushed out to the left as the next one comes in from the right, side by side, with a speed ramp and motion blur at the fastest point. Built in to events to build your own, and the tour to platforms, push upward the same way |
| Zoom-through (reveals) | into the first chapter, into the bento, into the AI scene and into the app tour (the drop): the outgoing scene flies toward the camera and dissolves into blur, a soft mint bloom fills the frame for a moment, and the next scene settles in from slightly small and soft to sharp |
| Match cut (finale) | the install command bar of the platforms scene stays while everything else leaves, then carries across the cut and transforms into the closing card's install command while the closing line and logo build around it |
| Camera | every scene is filmed by a slow camera push (about 3 percent over the scene), so no frame is still |
| Headlines | each word of a headline rises out of a mask one after another (kinetic type) |
| Feature scenes | the SendMock window slides in from the left and your app's terminal from the right; each request card is launched from the sending window, grows and travels to its place beside the line |
| Sound | each transition plays a whoosh that peaks at its midpoint, where the new scene takes over |
