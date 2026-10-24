import { Marquee } from "@/components/ui/marquee";

const languageNames = [
  "PHP",
  "Laravel",
  "Node.js",
  "Python",
  "Django",
  "Go",
  "Java",
  "Spring",
  "Rust",
  "Ruby",
  ".NET",
];

const providerNames = [
  "Twilio",
  "Twilio Verify",
  "Vonage",
  "SendGrid",
  "Mailgun",
  "Postmark",
  "Resend",
  "Amazon SES",
  "Slack",
  "Discord",
];

function NameBadge({ name }: { name: string }) {
  return (
    <span className="rounded-full border bg-fd-card px-4 py-1.5 text-sm text-fd-muted-foreground">
      {name}
    </span>
  );
}

export function WorksWithSection() {
  return (
    <section className="flex flex-col items-center gap-4 py-12">
      <h2 className="text-2xl font-semibold">Works with your stack</h2>
      <p className="text-fd-muted-foreground">
        Plain SMTP and HTTP, plus provider-compatible APIs. No SDK needed.
      </p>
      <div className="relative w-full max-w-4xl overflow-hidden">
        <Marquee pauseOnHover className="[--duration:30s]">
          {languageNames.map((languageName) => (
            <NameBadge key={languageName} name={languageName} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:30s]">
          {providerNames.map((providerName) => (
            <NameBadge key={providerName} name={providerName} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
