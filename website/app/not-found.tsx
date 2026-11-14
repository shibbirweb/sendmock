import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { docsVersionLinks } from "@/lib/current-docs-version";
import { baseOptions } from "@/lib/layout.shared";

/**
 * GitHub Pages serves this for every missing path, including a page the
 * version switcher opened in a version that does not have it (WS-03.6).
 */
export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-fd-muted-foreground">
          This page does not exist, or not in this docs version. Open the docs
          home of a version:
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {docsVersionLinks.map((versionLink) => (
            <li key={versionLink.key}>
              <a
                href={`${versionLink.href}docs/`}
                className="inline-flex rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-fd-accent"
              >
                {versionLink.label}
              </a>
            </li>
          ))}
        </ul>
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to the home page
        </Link>
      </main>
      <SiteFooter />
    </HomeLayout>
  );
}
