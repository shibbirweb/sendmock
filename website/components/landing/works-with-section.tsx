import { Marquee } from "@/components/ui/marquee";
import {
  allEmulatedProviderNames,
  frameworkNames,
  testedLanguageNames,
  webhookTargetNames,
} from "@/lib/landing-data";

function NameBadge({ name }: { name: string }) {
  return (
    <span className="rounded-full border bg-fd-card px-4 py-1.5 text-sm text-fd-muted-foreground">
      {name}
    </span>
  );
}

export function WorksWithSection() {
  return (
    <section
      aria-labelledby="works-with-heading"
      className="flex flex-col items-center gap-4 py-12"
    >
      <h2 id="works-with-heading" className="text-2xl font-semibold">
        Works with your stack
      </h2>
      <p className="px-4 text-center text-fd-muted-foreground">
        Plain SMTP and HTTP, plus provider-compatible APIs. No SDK changes.
      </p>
      <div
        data-testid="works-with-marquee"
        className="relative w-full max-w-4xl overflow-hidden"
      >
        <Marquee pauseOnHover className="[--duration:30s]">
          {[...testedLanguageNames, ...frameworkNames].map((stackName) => (
            <NameBadge key={stackName} name={stackName} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:30s]">
          {[...allEmulatedProviderNames, ...webhookTargetNames].map(
            (providerName) => (
              <NameBadge key={providerName} name={providerName} />
            ),
          )}
        </Marquee>
      </div>
    </section>
  );
}
