# 18. Phase U3: polish, website, contract freeze and sign-off

Phase U3 turns the Stage A UI into something the owner can approve, publishes the website around it, and freezes the API contract the backend will implement. Stage B (backend) starts only after the sign-off at the end of this phase ([11-roadmap.md](11-roadmap.md#phase-u3-polish-review-and-sign-off-about-1-week)).

## Goal and sign-off gate

**Done when:**

- every U3 item in [PROGRESS.md](PROGRESS.md) is ticked;
- the U3 acceptance features are tested and accepted: UI-05 Accessibility, UI-06 Performance, UI-07 Design consistency, UI-08 Notifications, UI-09 Contract freeze, UI-10 Community links, WS-02 Landing page, WS-04 Playground (Demo mode);
- the design review table below is signed off by the owner;
- `docs/api/openapi.yaml` is frozen;
- the owner approves the UI on the preview URL and ticks **Sign-off: UI approved, Stage B may start**.

Left over from U0 and done by the owner in GitHub settings: add the required status checks (Web UI, Acceptance traceability, Website) to the `develop` and `main` rulesets.

## Workstreams and order

All U3 workstreams are built on one branch, `feat/u3-design-review`, with a commit per workstream (decided 2026-10-26); the Branch column names the part only. The order puts UI changes first, so the design review looks at the final screens, and the contract freeze before the API reference and playground, which are generated from it.

| # | Workstream | Branch | Criteria | Depends on |
|---|------------|--------|----------|------------|
| W1 | Design review guards (D1) | `feat/u3-design-review` | UI-07.1, UI-07.2 | |
| W2 | Notifications | `feat/u3-notifications` | UI-08 | |
| W3 | Accessibility | `feat/u3-accessibility` | UI-05 | W2 |
| W4 | Responsive | `feat/u3-responsive` | UI-01.1 | W2 |
| W5 | Performance | `feat/u3-performance` | UI-06 | |
| W6 | Design review pass (D2) | `feat/u3-design-pass` | UI-07.3 (table filled) | W1 to W5 |
| W7 | Contract freeze | `feat/u3-contract-freeze` | UI-09 | W6 (no more API changes from the review) |
| W8 | Website landing page | `feat/u3-website-landing` | WS-02 | |
| W9 | Website docs structure | `feat/u3-website-docs` | (WS-03 later) | |
| W10 | API reference and playground (Demo mode) | `feat/u3-playground` | WS-04 | W7 |
| W11 | Feedback round and sign-off (D3) | `chore/u3-sign-off` | UI-07.3 signed | all |
| W12 | Community links and GitHub templates | `chore/u3-community` | UI-10 | |

## W1 and W6: Design review

Part of the review is automated so it stays true after sign-off; the rest is a written review per screen that the owner signs off.

#### What is checked

| Area | Passes when |
|------|-------------|
| **Page title** | The browser tab names the screen: `<Screen> · SendMock` (`Gateways · SendMock`), with the open item first where there is one (`Re: Reset your password · Mail · SendMock`, `+8801722222222 · SMS · SendMock`), and the checkout page `Pay Acme Shop · SSLCommerz test checkout`. |
| **Navigation** | A sidebar item with sub-items shows a chevron that points right when closed and down when open, so it reads as a group; the active sub-item and its parent are both marked. |
| **Hierarchy** | One clear page title and purpose line; the primary action is the only filled button in its area; secondary actions are outline or ghost; destructive actions are red and ask first. |
| **Spacing and layout** | Page padding, card padding and gaps use the shared scale (`gap-2/3/4/5`, `px-4 py-6 sm:px-6`); content is capped (`max-w-6xl`) on wide screens; nothing overflows at 1280 and 1440 wide. |
| **Consistency** | The same pattern for the same job: tables with an edit pencil and a side sheet, `Add <thing>` in the header, Built-in / Custom / Modified badges, `Reset to default` and `Delete` in the sheet footer, confirm dialogs that name the item. |
| **Microcopy** | Plain, concrete sentences; buttons say what happens ("Save gateway", not "Submit"); no em-dashes; units and examples where values are typed; errors say how to fix them. |
| **Loading** | Every screen that fetches shows a skeleton or spinner in the shape of its content, never a blank area or a layout jump. |
| **Empty** | Every list has an empty state that says what would appear and how to make it appear (connect snippet, sample button, or Add). Filters that match nothing offer Clear filter. |
| **Error** | Every screen that fetches shows an inline message when the API fails ("Could not load ... Try again."), keeps the rest of the shell usable, and recovers when the API answers again. |
| **Colour and tokens** | Colours, radius and type come from the design tokens; no hard-coded Tailwind palette colours (`text-amber-600`) or hex values in class names. Data colours (a gateway's accent, chart series) are the exception and come from data or chart tokens. |
| **Dark theme** | Every screen is readable in dark mode: no white panels, no low-contrast text. |

#### Automated guards (W1)

- **Design tokens (UI-07.1):** a unit test reads every source file under `web/src` (through Vite, outside `mocks/`) and fails on Tailwind palette colours (`text-amber-600`), `bg-white` / `text-black` and hex colours in class names, naming the file and line. The vendored shadcn components (`components/ui`) and the email preview (mail renders on white, as in a mail client) are the only exceptions. Inline `style` colours that come from data (a gateway's accent) are allowed.
- **Simulated errors everywhere:** the demo's "Always 500" and "Always 404" are applied by one mock handler before all others, so every endpoint honours them (the health check keeps answering).
- **States (UI-07.2):** an end-to-end test opens every screen three ways:
  - mock API answering 500: an inline "Could not load ..." message with **Try again**, the navigation still works, and the screen recovers when errors are turned off;
  - empty data set: the screen's empty state or onboarding card;
  - slow responses (2 s latency): a skeleton while loading.
- **Page titles (UI-07.4):** each route sets the document title through one `usePageTitle` hook; the states test checks that every screen has its own title ending in `· SendMock`.
- **Shared error state:** one `QueryErrorState` component (message and Try again) replaces the copies on each screen, and is added where a screen has none (webhooks overview, inbound routes, gateways, methods, flows, numbers, services, logs, HTTP bins).

#### Review table

The review table: each row is filled during the pass (`OK`, or the fix made), and the owner signs off each row in the PR that completes the pass.

| Screen | Path | Hierarchy | Spacing | Copy | Loading | Empty | Error | Dark | Notes | Signed off |
|--------|------|-----------|---------|------|---------|-------|-------|------|-------|------------|
| Overview | `/` | OK | Capped at `max-w-6xl` like the other pages (was `max-w-7xl`, so it stretched on wide screens) | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Mail | `/mail`, `/mail/{id}` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK | The subject wraps beside its actions on narrow screens (W4) | |
| SMS | `/sms`, `/sms/{thread}` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Verify | `/sms/verify` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| HTTP catcher | `/http` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK | The request detail tabs scroll sideways without clipping (W4) | |
| Webhooks overview | `/webhooks/overview` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Endpoints | `/webhooks/endpoints` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK | The sheet footer says Close, not Cancel, on purpose: the Security and Variables tabs save on their own | |
| Rules | `/webhooks/rules` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Inbound routes | `/webhooks/inbound-routes` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Deliveries | `/webhooks/deliveries` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Composer | `/webhooks/composer` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Templates | `/webhooks/templates` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Variables | `/webhooks/variables` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Saved deliveries | `/webhooks/saved` | OK | Capped at `max-w-6xl` like the other webhook pages (was `max-w-5xl`) | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Payments | `/payments` | OK | OK | The payment drawer shows provider id names as the provider writes them, in monospace (`tran_id`, not "tran id") | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Gateways | `/payments/gateways` | OK | The preview pickers fill their columns instead of a long payment name running into the next one | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK | The tabs stay in view while the form scrolls (W4) | |
| Methods | `/payments/methods` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Flows | `/payments/flows` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK | The variables table drops its Example column on phones (W4) | |
| Test checkout | `/pay/{session}` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK | Pay successfully is the only filled button in Test controls | |
| Numbers | `/numbers` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Logs | `/logs` | OK | OK | OK | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |
| Settings | `/settings` (every section) | Delete all emails and Delete all SMS are red like Reset to seed (they were outline) | OK | Keep forever reads "Turn off to delete traffic after a number of days." (it pointed at an age field that is hidden while on) | OK (W1 test) | OK (W1 test) | OK (W1 test) | OK |  | |

#### Pass (W6)

Light and dark screenshots of every screen at 1440 wide (and the sheets and dialogs each screen opens), reviewed against the checklist; each finding is fixed in the same PR and the table row filled in (`OK` or what changed).

Known fixes already listed for the pass:

- Sidebar groups (SMS, Webhooks, Payments) show a chevron on the parent item, rotating when the group opens. Done in W6; the SMS unread badge moves left of the chevron, and an end-to-end test checks which items have one and that it turns.

## W2: Notifications (UI-08)

As specified in [07-ui.md](07-ui.md#notifications):

- **Settings > Notifications** (a new section), saved in this browser like the theme, not on the server or in the seed:
  - **Show pop-up toasts** on (default) or off; off is the bell-only mode.
  - **Toast position:** top right (default), top center, top left, bottom right, bottom center or bottom left, with a preview toast shown at the chosen place when it changes.
- **Header bell** at the top right of the header (both modes): an unread count badge (hidden at zero, "99+" above 99); opens a popover list, newest first, each item with an icon, title, short description, relative time and a link to the email, SMS, verification or delivery; opening the list marks all read; **Clear all** empties it; an empty list says what will appear.
- Toast mode keeps the history of toasts already shown in the bell; bell-only mode shows no toasts at all. Opening the bell dismisses the visible toasts, since the list shows them.
- The list holds the last 50 notifications in memory for the session.
- Tests: unit tests for the notification store, end-to-end tests UI-08.1 to UI-08.3.

## W3: Accessibility (UI-05)

- **Automated (UI-05.2, UI-05.3):** `@axe-core/playwright` (dev dependency, about 1 MB, used only in tests; it is the standard engine and nothing lighter covers the WCAG rules) runs on every screen and on each screen's main sheet or dialog, in light and dark themes; no serious or critical violations, colour contrast included.
- **Keyboard walkthrough (UI-05.1):** end-to-end tests that use only the keyboard for the core flows: read an email and copy its OTP, reply to an SMS, add a webhook endpoint and send a test, replay a delivery, pay a test checkout, edit a payment flow step, and change a setting. Every focusable control shows a visible focus ring; sheets and dialogs trap focus and return it to the opener; a **Skip to content** link is the first tab stop.
- **Labels:** icon-only buttons have accessible names (checked by axe and by a test over every `size="icon*"` button); form fields have labels or `aria-label`.
- **Reduced motion (UI-05.4):** with `prefers-reduced-motion: reduce`, transitions and animations (sheets, toasts, skeleton pulse, chart tooltips) are disabled or reduced to a fade; an end-to-end test emulates reduced motion and checks computed `transition-duration` / `animation-name` on representative elements.
- Findings are fixed in the same PR.

## W4: Responsive (UI-01.1)

- **Widths checked:** 360 and 390 (phone), 768 (tablet), 1024 and 1280 (laptop split screen and laptop), 1440 and 2560 (desktop).
- **Rules:** no horizontal page scroll at any width; the sidebar becomes a sheet below 768; three-pane screens (Mail, SMS, HTTP) show one pane at a time on phones with a back button; tables hide secondary columns and keep the row action reachable; sheets are full width on phones; dialogs fit 360 wide; the checkout page stacks the order summary above the payment panel.
- **Test:** an end-to-end test visits every screen at every width above and fails on any element past the right edge that is not inside an intended horizontal scroller (`overflow-x-auto`, a table container, `pre`) and on a page-level horizontal scroll; it also opens the editing sheets at 360 wide tab by tab, checks the sidebar drawer closes after navigating on a phone, and checks the checkout stacking; screenshots at each width are reviewed and fixed.
- **Tab strips** that can be wider than a phone sit in an `overflow-x-auto` wrapper outside the scrolling form, so they scroll sideways without clipping and stay in view while the form scrolls.

## W5: Performance (UI-06)

- **Bundle budget (UI-06.1):** a script measures the gzipped size of the initial JS (the entry chunk and what it imports eagerly) after `vite build` and fails CI above 250 KB; CodeMirror, the chart code and other heavy screens load lazily (route-level code splitting with TanStack Router's lazy routes).
- **Large data (UI-06.2):** with the large data set (5,000 emails, 2,000 log rows), the mail list, logs and deliveries stay virtualised or paged; an end-to-end test measures opening an email (click to rendered detail) under 200 ms and checks the list renders only visible rows.
- **Embedded size (UI-06.3):** `web/dist` without source maps stays under 2 MB, checked in the same script.
- **What is measured:** the live build (`VITE_API_MODE=live`), the one the binary embeds. The mock layer, faker data and the demo toolbar are imported behind a literal `import.meta.env.VITE_API_MODE !== "live"` check at the import site, so the bundler drops them from a live build instead of emitting unused chunks (a shared constant is not folded early enough). The `/demo/` site keeps the mock build. The check is `bun run test:budget` (`web/tests/budget/`), which builds into a temporary folder and runs in CI.
- Findings (large chunks, eager imports) are fixed in the same PR.

## W7: Contract freeze (UI-09)

The API the mock answers becomes the spec the backend implements ([06-api.md](06-api.md)):

- **Endpoint registry:** `web/src/lib/api/endpoint-registry.ts` lists every endpoint: method, path, summary, path and query parameters, request type and response type (by name from `types.ts`), and error statuses.
- **Generation:** `scripts/build-openapi.ts` turns the registry and the TypeScript types into `docs/api/openapi.yaml` (OpenAPI 3.1), using `ts-json-schema-generator` for the schemas (dev dependency; it reads the existing types, so the spec cannot drift from them, and writing 2,000 lines of schemas by hand would).
- **Drift checks (CI):** a test fails when an MSW handler answers a path the registry does not list, or the registry lists one no handler answers; the generated spec must equal the committed file; the spec is validated with an OpenAPI linter.
- **Review:** the spec is read against [06-api.md](06-api.md) and the provider docs; differences are fixed in the types or the plan.
- **Frozen:** after this PR, API changes need a plan change first; in Stage B the backend generates the spec with `utoipa` and the contract tests (PL-01.1) compare it with this file.
- **As built:** the registry is one file per area under `web/src/lib/api/endpoint-registry/` (plain data, types named by string, relative imports only, so the build script reads it without the app's path aliases). `web/scripts/build-openapi.ts` (`bun run openapi`, `--check`) writes an entry file with `PageOf<T>` and `Partial<T>` roots and runs `ts-json-schema-generator` on it, so page and patch schemas come from the real generic types; objects stay open (`additionalProperties` is not set false) so adding a field is not breaking. The drift test is `web/src/mocks/handlers/handlers-match-endpoint-registry.test.ts` (Vitest); `web/tests/contract/openapi.test.ts` (`bun run test:contract`, in CI) compares the committed file with a fresh build, resolves every `$ref` and validates the document with `@seriousme/openapi-schema-validator` (dev dependency, 166 KB, the OpenAPI 3.1 JSON Schema check without a CLI framework). `yaml` (dev dependency, no dependencies) writes the file; Bun's built-in YAML writer leaves trailing spaces.
- **Review against 06-api.md:** recorded in [06-api.md](06-api.md#contract): path parameter and filter names now match the spec, reply, forward, inbound routes and the reply-webhook resend are added to the tables, and the planned endpoints no screen calls yet are listed; they join the spec when their backend lands.

## W8: Website landing page (WS-02)

As planned in [16-website-and-releases.md](16-website-and-releases.md#landing-page-with-magic-ui), building on the sections already in `website/components/landing/` (hero, quick start, works with, features):

- Hero (animated gradient or shiny text, shimmer button, dot pattern), **Animated Beam** flow (your app to SendMock to the UI, and webhooks back), **Terminal** quick start, **Marquee** of languages and providers, **Bento Grid** of features (email, SMS and Verify, webhooks, HTTP catcher, payments, AI and MCP, Docker), **Number Ticker** (providers emulated, languages, template count), product screenshots from the mock UI in a browser frame, and the footer call to action.
- Screenshots generated from the mock-mode UI with Playwright, so they stay current.
- Reduced motion renders every animation static (WS-02.2); Lighthouse at least 90 in all four categories (WS-02.3), checked in CI with Lighthouse CI on the built site.
- **As built:** the Number Ticker counts what the page itself lists (the emulated providers and tested languages from `website/lib/landing-data.ts`, shared with the marquee) and the REST operations in `docs/api/openapi.yaml`, read when the site is built; the template count was dropped because the website cannot read the web app's fixtures. The hero's dot pattern is a CSS background: Magic UI's `DotPattern` rendered hundreds of SVG circles after hydration and cost about 25 Lighthouse performance points. The terminal, ticker and beam check `useReducedMotion`: the terminal shows every line, the ticker's static HTML already holds the final value, and the beam draws only its path. Screenshots come from `bun run screenshots` (Playwright against the mock-mode app, light and dark, JPEG); the Safari frame lazy-loads them so each theme fetches one. Tests in `website/tests/landing.spec.ts`; Lighthouse CI (`website/lighthouserc.json`, median of three runs) and the tests run in the Website workflow.

## W9: Website docs structure

- `docs/wiki/` holds the user docs as Markdown, synced into `website/content/docs` at build time; the structure from the site map: getting started, install, connect your app (per language), email, SMS, Verify, webhooks, templates, variables, HTTP catcher, payments, CLI, MCP and AI, configuration and seed file, troubleshooting.
- Each page gets its outline and the parts already true in Stage A (UI tours with screenshots); backend-dependent pages say "available in Phase N" until then.
- Internal links are checked in CI (part of WS-03.3).

## W10: API reference and playground in Demo mode (WS-04)

- **Reference:** `/api/` pages generated from the frozen `openapi.yaml` (Fumadocs OpenAPI pages for the text).
- **Playground (Demo mode):** our own React components (shadcn), answered in the browser by the shared mock layer (`web/src/mocks` as a workspace package): request builder from the schema, response viewer, and code snippets in cURL, PHP, JavaScript, Python, Go, Java, Rust, Ruby and C# kept in sync with the form (WS-04.1, the snippet part of WS-04.2).
- **Event stream panel** showing the events a request triggered, and **scenario mode** (send SMS, wait, read the OTP, verify) (WS-04.3).
- Running the snippets against a real instance (the rest of WS-04.2) waits for the backend.

## W12: Community links and GitHub templates (UI-10)

So people can find the project, give feedback and report problems from wherever they use it:

- **In the app:** a **Help** menu in the header (a circle-question icon) and the same links on Settings > About:
  - **Documentation** (the website's `/docs/`), **Keyboard shortcuts** (opens the existing help dialog), **What's new** (the changelog);
  - **Report an issue** and **Request a feature**: open the matching GitHub issue form in a new tab, pre-filled with the SendMock version, channel, OS and browser (`?template=bug_report.yml&version=...`), never with any captured data;
  - **Report a security issue**: GitHub's private vulnerability reporting (`/security/advisories/new`), with a note not to open a public issue;
  - **Star on GitHub**: the repository, with a star icon. The link is shown, not a nag: no pop-ups asking for stars.
  - In the mock-mode demo the same links work, so feedback on the preview URL goes straight to issues (W11).
- **On the website:** header GitHub link with the star count, and the footer links (docs, issues, feature requests, security, changelog, star).
- **GitHub templates** (`.github/`):
  - `ISSUE_TEMPLATE/bug_report.yml`: version, install method (binary, Docker, Homebrew, ...), OS, what happened, what was expected, steps, which part (email, SMS, Verify, webhooks, HTTP catcher, payments, CLI, MCP, UI), logs; a checkbox to confirm no secrets or real customer data are pasted.
  - `ISSUE_TEMPLATE/feature_request.yml`: the problem, the proposed behaviour, which part, alternatives, and whether a provider's docs describe it (link).
  - `ISSUE_TEMPLATE/provider_request.yml`: a provider to emulate (email, SMS, payment gateway, webhook format) with links to its API docs, since these are the most common requests.
  - `ISSUE_TEMPLATE/docs.yml`: a docs page that is wrong or missing.
  - `ISSUE_TEMPLATE/config.yml`: blank issues off, links to Discussions (questions), the docs, and private security reporting.
  - `pull_request_template.md`: summary, linked issue, test plan as plain bullets, and the AGENTS.md checklist (parity, tests naming criteria, CHANGELOG, no em-dashes).
  - `SECURITY.md`: supported versions, how to report privately (GitHub advisories), what to expect and when; `CONTRIBUTING.md`: setup with Bun, branches into `develop`, commit format, tests; `CODE_OF_CONDUCT.md` (Contributor Covenant).
  - Labels used by the templates (`bug`, `enhancement`, `provider`, `docs`, `u3-feedback`) are listed in `CONTRIBUTING.md`.
- Tests: an end-to-end test checks the Help menu links (targets and pre-filled version); the YAML templates are validated in CI.

## W11: Feedback round and sign-off (D3)

- The preview URL (`/demo/` and the site) is shared; feedback is collected as GitHub issues with the `u3-feedback` label; each is fixed or recorded as a decision.
- The owner walks through the review table and signs off each row; UI-07.3 is ticked.
- When every U3 item and criterion above is done, the owner ticks **Sign-off: UI approved, Stage B may start**.
