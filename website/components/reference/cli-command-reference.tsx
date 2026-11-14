import Link from "next/link";

import type {
  CliArgument,
  CliCommand,
  CliFlag,
} from "@/lib/reference/reference-types";

import { InlineCodeText, InputTable, type InputTableRow } from "./input-table";
import { type NamedLink, OtherWaysList } from "./other-ways-list";

function toArgumentRow(cliArgument: CliArgument): InputTableRow {
  return {
    key: cliArgument.name,
    name: `<${cliArgument.name}>`,
    type: cliArgument.type,
    isRequired: true,
    description: cliArgument.description,
    allowedValues: cliArgument.allowed_values,
    example: cliArgument.example,
  };
}

function toFlagRow(cliFlag: CliFlag): InputTableRow {
  const flagName =
    cliFlag.value_label === null
      ? `${cliFlag.flag}`
      : `${cliFlag.flag} ${cliFlag.value_label}`;
  const typeNotes = [
    cliFlag.is_repeatable ? "repeat for more" : null,
    cliFlag.takes_json ? "JSON" : null,
  ].filter((typeNote) => typeNote !== null);
  return {
    key: cliFlag.flag,
    name: flagName,
    type:
      typeNotes.length > 0
        ? `${cliFlag.type} (${typeNotes.join(", ")})`
        : cliFlag.type,
    isRequired: cliFlag.is_required,
    description:
      cliFlag.value_label === null && cliFlag.input !== null
        ? `${cliFlag.description} \`${cliFlag.flag.replace("--", "--no-")}\` sets it to false.`
        : cliFlag.description,
    allowedValues: cliFlag.allowed_values,
    example: cliFlag.value_label === null ? undefined : cliFlag.example,
  };
}

/** One CLI command: usage, arguments, flags, an example, output and links. */
export function CliCommandReference({
  cliCommand,
  mcpLinks,
}: {
  cliCommand: CliCommand;
  mcpLinks: NamedLink[];
}) {
  return (
    <article
      id={cliCommand.slug}
      data-testid="cli-command"
      className="grid scroll-mt-20 gap-3 border-t py-8"
    >
      <h2 className="text-lg font-semibold">
        <code className="font-mono break-all">{cliCommand.command}</code>
      </h2>
      <p className="text-fd-muted-foreground">
        <InlineCodeText text={cliCommand.summary} />
      </p>
      <pre
        tabIndex={0}
        aria-label="Usage"
        className="overflow-x-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
      >
        {cliCommand.usage}
      </pre>
      {cliCommand.aliases.length > 0 && (
        <p className="text-sm text-fd-muted-foreground">
          Also runs as{" "}
          {cliCommand.aliases.map((alias, aliasIndex) => (
            <span key={alias}>
              {aliasIndex > 0 && ", "}
              <code className="font-mono">{alias}</code>
            </span>
          ))}
          .
        </p>
      )}
      {cliCommand.arguments.length > 0 && (
        <InputTable
          label={`Arguments of ${cliCommand.command}`}
          nameHeading="Argument"
          inputRows={cliCommand.arguments.map(toArgumentRow)}
        />
      )}
      {cliCommand.flags.length > 0 && (
        <InputTable
          label={`Flags of ${cliCommand.command}`}
          nameHeading="Flag"
          inputRows={cliCommand.flags.map(toFlagRow)}
        />
      )}
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">Example</h3>
        <pre
          tabIndex={0}
          data-testid="cli-example"
          className="overflow-x-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs"
        >
          {cliCommand.example}
        </pre>
      </section>
      <p className="text-sm">
        <span className="text-fd-muted-foreground">Output with </span>
        <code className="font-mono">--json</code>
        <span className="text-fd-muted-foreground">: </span>
        {cliCommand.output === null ? (
          <span>nothing</span>
        ) : (
          <code className="font-mono break-all">{cliCommand.output}</code>
        )}
        <span className="text-fd-muted-foreground">
          .{" "}
          <Link href="/cli/#exit-codes" className="underline">
            Exit codes
          </Link>
          : {cliCommand.exit_codes.join(", ")}.
        </span>
      </p>
      <OtherWaysList
        operations={cliCommand.operations}
        otherSurfaceLabel="MCP tool"
        otherSurfaceLinks={mcpLinks}
        uiPlaces={cliCommand.ui}
      />
    </article>
  );
}
