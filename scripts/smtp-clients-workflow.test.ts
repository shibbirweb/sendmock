import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

type ClientEntry = { client: string; folder: string; run: string };

const smtpClientsWorkflow = Bun.YAML.parse(
  readFileSync(".github/workflows/smtp-clients.yml", "utf8"),
) as { jobs: { client: { strategy: { matrix: { include: ClientEntry[] } } } } };
const clientEntries = smtpClientsWorkflow.jobs.client.strategy.matrix.include;

describe("SMTP clients workflow", () => {
  test("EM-01.5 sends with every client the criterion names, each from its example folder", () => {
    expect(clientEntries.map((clientEntry) => clientEntry.client)).toEqual(
      expect.arrayContaining([
        "Laravel",
        "Symfony Mailer",
        "Nodemailer",
        "Python smtplib",
        "Django",
        "Go net/smtp",
        "Spring",
        "lettre",
        "Action Mailer (Rails)",
        "MailKit",
      ]),
    );
    for (const clientEntry of clientEntries) {
      expect(existsSync(`examples/smtp/${clientEntry.folder}`)).toBe(true);
    }
  });

  test("EM-06.2 PHP mail() delivers through sendmail_path pointing at the shim", () => {
    const phpMailEntry = clientEntries.find(
      (clientEntry) => clientEntry.folder === "php-mail",
    );

    expect(phpMailEntry?.run).toContain(
      'sendmail_path="$GITHUB_WORKSPACE/sendmock-binary/sendmock sendmail -t -i"',
    );
  });

  test("EM-21.6 Python poplib reads the mailbox with POP3 turned on for the job", () => {
    const poplibEntry = clientEntries.find(
      (clientEntry) => clientEntry.folder === "python-poplib",
    );
    const workflowText = readFileSync(
      ".github/workflows/smtp-clients.yml",
      "utf8",
    );
    const exampleSource = readFileSync(
      "examples/smtp/python-poplib/verify.py",
      "utf8",
    );

    expect(poplibEntry?.run).toBe("python verify.py");
    expect(workflowText).toContain("SENDMOCK_POP3_ADDR: 127.0.0.1:1110");
    expect(exampleSource).toContain("poplib.POP3");
    expect(exampleSource).toContain('app_info["pop3_address"]');
  });
});
