import { CopyButton } from "@/components/common/copy-button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";

/** One fact a POP3 client asks for, with its value to copy. */
function Pop3Fact({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <code className="truncate font-mono text-sm">{value}</code>
      </div>
      <CopyButton copyText={value} label={copyLabel} />
    </div>
  );
}

/** How a mail client or a script reads the captured mail over POP3, when it is on (EM-21.6). */
export function Pop3AccessCard({
  pop3Address,
  host,
}: {
  pop3Address: string;
  host: string;
}) {
  const pop3Port = pop3Address.split(":").at(-1) ?? "";

  return (
    <SettingsSectionCard
      title="POP3"
      description="Read the captured mail with a mail client or a POP3 library. The username picks the mailbox: a project's key reads that project, any other name reads Default. The password is anything, unless SendMock was started with --pop3-auth file:<path>."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Pop3Fact
          label="POP3 host"
          value={host}
          copyLabel="Copy the POP3 host"
        />
        <Pop3Fact
          label="POP3 port"
          value={pop3Port}
          copyLabel="Copy the POP3 port"
        />
      </div>
    </SettingsSectionCard>
  );
}
