import type { ReactNode } from "react";

import { basePath } from "@/lib/layout.shared";

/**
 * Link to the mock-mode app at /demo/. It is a separate Vite app, so this is a
 * plain anchor: a Next.js Link would try to prefetch it as a Next route.
 */
export function DemoLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={`${basePath}/demo/`} className={className}>
      {children}
    </a>
  );
}
