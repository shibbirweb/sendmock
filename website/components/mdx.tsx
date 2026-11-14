import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, ComponentType } from "react";

import { DemoLink } from "@/components/demo-link";
import { basePath } from "@/lib/layout.shared";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    DemoLink,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

type AnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

/**
 * Links in docs/wiki Markdown: `/demo/...` goes to the demo app (a separate
 * Vite app, so a plain anchor with the base path); everything else, including
 * relative `.md` links, goes through Fumadocs' relative link.
 */
export function createDocsLink(RelativeLink: ComponentType<AnchorProps>) {
  return function DocsLink({ href, children, ...anchorProps }: AnchorProps) {
    if (href?.startsWith("/demo")) {
      return (
        <a href={`${basePath}${href}`} {...anchorProps}>
          {children}
        </a>
      );
    }

    return (
      <RelativeLink href={href} {...anchorProps}>
        {children}
      </RelativeLink>
    );
  };
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
