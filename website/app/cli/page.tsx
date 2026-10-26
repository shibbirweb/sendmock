import type { Metadata } from "next";
import Link from "next/link";

import { InlineCodeText } from "@/components/reference/input-table";
import {
  listAreas,
  loadCliReference,
  toCliCommandUrl,
} from "@/lib/reference/load-references";

export const metadata: Metadata = {
  title: "CLI reference",
  description:
    "Every sendmock command with its arguments, flags, an example, output and exit codes, generated from the API contract.",
};

function ConventionsSection() {
  return (
    <section aria-labelledby="flag-rules" className="grid gap-2">
      <h2 id="flag-rules" className="text-xl font-semibold">
        How commands take input
      </h2>
      <ul className="grid list-disc gap-1 pl-5 text-fd-muted-foreground">
        <li>
          Every command runs one REST operation. Its path parameters are
          arguments in <code className="font-mono">&lt;&gt;</code>, and its body
          and query fields are flags:{" "}
          <code className="font-mono">bounce_type</code> is{" "}
          <code className="font-mono">--bounce-type</code>.
        </li>
        <li>
          Switches: <code className="font-mono">--read</code> sets{" "}
          <code className="font-mono">is_read</code> to true,{" "}
          <code className="font-mono">--no-read</code> to false. Lists repeat
          the flag in the singular:{" "}
          <code className="font-mono">--tag signup --tag qa</code>. Objects take
          JSON.
        </li>
        <li>
          The whole body can come from <code className="font-mono">--data</code>{" "}
          or <code className="font-mono">--file</code>; flags override its keys.
          A field that may be null can be left out.
        </li>
        <li>
          Commands never prompt. Destructive ones need{" "}
          <code className="font-mono">--yes</code>, and{" "}
          <code className="font-mono">--json</code> is the default when the
          output is not a terminal, so scripts and agents read JSON.
        </li>
      </ul>
    </section>
  );
}

export default function CliReferencePage() {
  const cliReference = loadCliReference();
  const areas = listAreas(cliReference.commands);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12">
      <header className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">CLI reference</h1>
        <p className="text-fd-muted-foreground">
          The <code className="font-mono">sendmock</code> binary is also the
          client: every command talks to a running SendMock over HTTP. Each
          entry lists the arguments and flags, an example, the output and the
          same thing from the{" "}
          <Link className="underline" href="/api">
            API
          </Link>{" "}
          and the{" "}
          <Link className="underline" href="/mcp">
            MCP server
          </Link>{" "}
          ({cliReference.commands.length} commands).
        </p>
      </header>
      <ConventionsSection />
      <section aria-labelledby="global-flags" className="grid gap-2">
        <h2 id="global-flags" className="text-xl font-semibold">
          Global flags
        </h2>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {cliReference.global_flags.map((globalFlag) => (
            <div key={globalFlag.flag} className="contents">
              <dt className="font-mono text-xs">
                {globalFlag.flag} {globalFlag.value_label ?? ""}
              </dt>
              <dd className="text-fd-muted-foreground">
                <InlineCodeText text={globalFlag.description} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="exit-codes" className="grid gap-2">
        <h2 id="exit-codes" className="text-xl font-semibold">
          Exit codes
        </h2>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {cliReference.exit_codes.map((exitCode) => (
            <div key={exitCode.code} className="contents">
              <dt className="font-mono text-xs">{exitCode.code}</dt>
              <dd className="text-fd-muted-foreground">{exitCode.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
      {areas.map((area) => (
        <section
          key={area.slug}
          aria-labelledby={`area-${area.slug}`}
          className="grid gap-2"
        >
          <h2 id={`area-${area.slug}`} className="text-xl font-semibold">
            <Link href={`/cli/${area.slug}`} className="hover:underline">
              {area.name}
            </Link>
          </h2>
          <ul className="grid gap-1">
            {cliReference.commands
              .filter((cliCommand) => cliCommand.area_slug === area.slug)
              .map((cliCommand) => (
                <li key={cliCommand.slug}>
                  <Link
                    href={toCliCommandUrl(cliCommand)}
                    className="flex flex-wrap items-baseline gap-x-3 rounded-md px-2 py-1 text-sm hover:bg-fd-accent"
                  >
                    <code className="font-mono text-xs break-all">
                      {cliCommand.command}
                    </code>
                    <span className="hidden text-fd-muted-foreground md:inline">
                      {cliCommand.summary}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
