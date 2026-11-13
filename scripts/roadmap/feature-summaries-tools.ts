import type { FeatureSummary } from "./feature-summaries";

/** AI, the web UI, distribution, the website and payments. */
export const toolFeatureSummaries: Record<string, FeatureSummary> = {
  "AI-01": {
    summary:
      "A CLI for every operation, with JSON output and stable exit codes.",
    outcome: "Script SendMock from shells, CI and coding agents.",
  },
  "AI-02": {
    summary:
      "An MCP server exposing every operation as a tool, grouped into toolsets, with an embedded mode.",
    outcome:
      "AI coding agents can send, inspect and assert on email, SMS and webhooks directly.",
  },
  "AI-03": {
    summary:
      "MCP resources and prompts for messages, events and common tasks, with subscriptions.",
    outcome:
      "Agents can read SendMock data as context and follow ready-made workflows.",
  },
  "AI-04": {
    summary:
      "Scenarios: declarative multi-step flows that send, wait and assert, run from the CLI.",
    outcome: "Describe an end-to-end check once and run it anywhere.",
  },
  "AI-05": {
    summary:
      "An agent skill, `sendmock ai install`, a Claude Code plugin, an MCP registry listing and skill evals.",
    outcome: "Set up an AI coding agent to use SendMock in one step.",
  },
  "AI-06": {
    summary:
      "`llms.txt` and `llms-full.txt` describing SendMock and every docs page for language models.",
    outcome: "Agents and LLM tools find accurate, current documentation.",
  },
  "UI-01": {
    summary:
      "The app shell: sidebar navigation, command palette, keyboard shortcuts, themes and a responsive layout.",
    outcome: "Move around the app quickly on any screen size.",
  },
  "UI-02": {
    summary:
      "A mock API layer that lets the whole UI run without a backend, behind the same typed API client.",
    outcome:
      "The demo and UI development work with no server, and the UI never depends on mock internals.",
  },
  "UI-03": {
    summary:
      "An overview dashboard with today's counts, activity over time, webhook health and recent failures.",
    outcome:
      "See what is happening across email, SMS and webhooks at a glance.",
  },
  "UI-04": {
    summary:
      "Empty states that explain how to connect, with sample buttons and copyable addresses.",
    outcome:
      "New users get from install to their first captured message quickly.",
  },
  "UI-05": {
    summary:
      "Accessibility: WCAG 2.1 AA, keyboard use, screen reader labels and reduced motion.",
    outcome: "Everyone can use SendMock.",
  },
  "UI-06": {
    summary: "Performance budgets for bundle size, load time and large lists.",
    outcome: "The UI stays fast with many thousands of messages.",
  },
  "UI-07": {
    summary:
      "One design system: shared tokens, components and patterns, and a design review of every screen.",
    outcome: "A consistent, predictable interface.",
  },
  "UI-08": {
    summary: "In-app notifications and toasts for new traffic and failures.",
    outcome: "Notice important events without watching every screen.",
  },
  "UI-09": {
    summary:
      "A frozen API contract: the OpenAPI document generated from the TypeScript types and checked against the mock handlers.",
    outcome: "The UI, the server and the docs agree on every endpoint.",
  },
  "UI-10": {
    summary:
      "Help and community links: docs, shortcuts, changelog, issue forms, security policy and contributing guide.",
    outcome: "Users can get help, report problems and contribute easily.",
  },
  "UI-11": {
    summary:
      "Every operation reachable from the UI, the REST API, the CLI and MCP, checked by a surface catalogue.",
    outcome:
      "Whatever someone can do in one place, they can do in every other.",
  },
  "UI-12": {
    summary:
      "A clear Not available yet state for screens and actions the running server does not serve yet.",
    outcome:
      "A newer UI against an older binary explains itself instead of failing.",
  },
  "UI-13": {
    summary:
      "Every icon-only button, link and toggle shows a tooltip naming its action, and its shortcut when it has one, on hover and on keyboard focus.",
    outcome: "Know what an icon does before clicking it.",
  },
  "DS-01": {
    summary:
      "A single self-contained binary for macOS, Linux and Windows on x64 and arm64, with the web UI embedded.",
    outcome:
      "Install by downloading one file, with no runtime or dependencies.",
  },
  "DS-02": {
    summary:
      "A small, non-root Docker image for amd64 and arm64 with channel tags, debug variants, signatures, an SBOM and provenance.",
    outcome:
      "Run SendMock in Docker, Compose or CI service containers with a trusted image.",
  },
  "DS-03": {
    summary:
      "Install scripts and package channels: Homebrew, Scoop, npm, cargo, APT and YUM, WinGet, Chocolatey, AUR, COPR and Nixpkgs.",
    outcome:
      "Install and update SendMock with the tool each platform already uses.",
  },
  "DS-04": {
    summary:
      "Release workflows for beta and stable releases, run from GitHub Actions only.",
    outcome: "Releases are repeatable, tested and never cut by hand.",
  },
  "DS-05": {
    summary:
      "Version management from tags and commits, with the changelog written by the release workflow.",
    outcome: "Versions and release notes are always consistent.",
  },
  "DS-06": {
    summary: "Testcontainers modules for Java, Node, Go, Python and .NET.",
    outcome:
      "Start SendMock from integration tests in the language a team already uses.",
  },
  "DS-07": {
    summary:
      "Binary size, idle memory, cold start and SMTP throughput budgets enforced in CI.",
    outcome: "SendMock stays lightweight as it grows.",
  },
  "DS-08": {
    summary:
      "A menu bar and system tray app that finds or starts SendMock, shows the unread email and SMS counts, opens the web UI and stops what it started.",
    outcome:
      "Keep SendMock running all day without a terminal window, and see at a glance that mail arrived.",
  },
  "DS-09": {
    summary:
      "A Helm chart that runs SendMock on Kubernetes with health probes, SMTP and HTTP services, optional persistence, provider port and Ingress.",
    outcome:
      "Run one shared SendMock for a team or a CI cluster with a single helm install.",
  },
  "DS-10": {
    summary:
      "A Docker Desktop extension that runs SendMock and opens its web UI from Docker Desktop's dashboard.",
    outcome: "Start SendMock with one click in Docker Desktop.",
  },
  "WS-01": {
    summary:
      "The website, built and tested on every pull request and published to GitHub Pages, with the live demo at `/demo/`.",
    outcome: "Anyone can read the docs and try SendMock in the browser.",
  },
  "WS-02": {
    summary:
      "A landing page that explains SendMock, with the quick start, the product screens and the promotional video.",
    outcome:
      "Visitors understand what SendMock does and how to start in under a minute.",
  },
  "WS-03": {
    summary:
      "Versioned docs: the stable docs at `/`, the beta at `/next/` and older minors at `/vX.Y/`, with a version switcher and banners.",
    outcome: "Readers always see docs that match the version they run.",
  },
  "WS-04": {
    summary:
      "An API playground in the browser that calls every endpoint against an in-browser demo and shows code in nine languages, the CLI and MCP.",
    outcome: "Try the API before installing anything, then copy working code.",
  },
  "WS-05": {
    summary:
      "The API playground's Local mode, sending requests to a SendMock running on the reader's machine.",
    outcome: "Explore a real instance from the docs.",
  },
  "WS-06": {
    summary:
      "A user guide with a page for every screen and Settings section, recipes and advanced walkthroughs.",
    outcome:
      "Users learn each screen and common tasks from one consistent guide.",
  },
  "WS-07": {
    summary:
      "CLI and MCP references generated from the API spec and the surface catalogue.",
    outcome:
      "Every command and tool is documented accurately, with links between the API, CLI and MCP.",
  },
  "WS-08": {
    summary:
      "Code examples in CLI, PHP, JavaScript, Python, Go, Java, Rust, Ruby and C#, checked against the contract and run in CI.",
    outcome: "Copy examples in your language that are known to work.",
  },
  "WS-09": {
    summary:
      "An Install with AI prompt that lets a coding agent install and start SendMock safely.",
    outcome:
      "Install SendMock by asking an AI agent, with each step shown for approval.",
  },
  "WS-10": {
    summary:
      "Deeper docs: a page per screen explaining every control and text, kept true by a crawl of the UI.",
    outcome: 'Answer any "what does this button do" question from the docs.',
  },
  "WS-11": {
    summary:
      "Google Analytics 4 on the docs website, behind a consent banner, counting page views per docs version and install-command copies.",
    outcome:
      "See how many people read the docs, which pages and from where, to decide what to improve next.",
  },
  "WS-12": {
    summary:
      "A From your code section on every docs page, sub-pages included, with an example for each task in nine languages, checked against the API and run in CI.",
    outcome:
      "Copy working code for any task straight from the page that explains it.",
  },
  "PY-01": {
    summary:
      "Payment safety: only documented test cards are accepted, and no card number or CVC is ever stored.",
    outcome: "Test payments with no risk of handling real card data.",
  },
  "PY-02": {
    summary:
      "A native payments API to create payments and checkouts and read their state.",
    outcome: "Script payment scenarios without a provider SDK.",
  },
  "PY-03": {
    summary:
      "A hosted test checkout page with cards, wallets, 3-D Secure and decline outcomes.",
    outcome: "Walk through checkout flows like a real customer.",
  },
  "PY-04": {
    summary:
      "Stripe emulation: payment intents, checkout sessions, refunds, disputes, subscriptions and Stripe-signed webhooks.",
    outcome:
      "Apps using Stripe's SDKs run against SendMock by changing the base URL.",
  },
  "PY-05": {
    summary:
      "PayPal emulation: Orders v2, captures, refunds, webhooks with signature verification and IPN.",
    outcome: "Test PayPal integrations without the PayPal sandbox.",
  },
  "PY-06": {
    summary:
      "SSLCommerz emulation: session init, IPN, validation, refunds and transaction queries.",
    outcome: "Test SSLCommerz checkouts locally.",
  },
  "PY-07": {
    summary:
      "After-payment operations: capture, void, refunds, expiry, disputes and subscriptions.",
    outcome: "Test what happens after a payment, not only the checkout.",
  },
  "PY-08": {
    summary:
      "Payment events, provider webhook templates and signed delivery for every gateway.",
    outcome: "Payment webhook handlers can be tested end to end.",
  },
  "PY-09": {
    summary:
      "Payments screens: payments, gateways, methods, flows, subscriptions and the Simulate panel.",
    outcome: "See and control every payment from the UI.",
  },
  "PY-10": {
    summary:
      "More gateways: bKash, Razorpay and Paddle, each verified with its official SDK helpers.",
    outcome: "Test regional and subscription-focused gateways too.",
  },
  "PY-11": {
    summary:
      "Payments in the CLI, MCP and test helpers, including waiting for a payment.",
    outcome: "Automate payment checks from scripts and agents.",
  },
  "PY-12": {
    summary:
      "Configurable payment gateways, methods and flows, built-in or custom, from the UI or the seed file.",
    outcome:
      "Model any gateway an app uses, including local ones SendMock does not ship.",
  },
};
