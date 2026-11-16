import type { BreadcrumbItem } from "fumadocs-core/breadcrumb";

import type { BreadcrumbLink } from "@/lib/seo/structured-data";

export type BreadcrumbStep = {
  name: string;
  /** Path under the site root, such as "/docs/mail". */
  pagePath: string;
};

/**
 * The docs part of a breadcrumb trail from Fumadocs' items: folders without a
 * page of their own and non-text names are left out, since every step needs
 * an address.
 */
export function toDocsBreadcrumbSteps(
  breadcrumbItems: BreadcrumbItem[],
): BreadcrumbStep[] {
  return breadcrumbItems.flatMap((breadcrumbItem) => {
    if (
      typeof breadcrumbItem.name !== "string" ||
      breadcrumbItem.url === undefined
    ) {
      return [];
    }
    return [{ name: breadcrumbItem.name, pagePath: breadcrumbItem.url }];
  });
}

/**
 * Home first, then each step once (a section's index page can repeat its
 * parent), as absolute URLs.
 */
export function buildBreadcrumbLinks(
  breadcrumbSteps: BreadcrumbStep[],
  buildPageUrl: (pagePath: string) => string,
): BreadcrumbLink[] {
  const seenUrls = new Set<string>();
  const homeStep: BreadcrumbStep = { name: "SendMock", pagePath: "/" };

  return [homeStep, ...breadcrumbSteps].flatMap((breadcrumbStep) => {
    const pageUrl = buildPageUrl(breadcrumbStep.pagePath);
    if (seenUrls.has(pageUrl)) {
      return [];
    }
    seenUrls.add(pageUrl);
    return [{ name: breadcrumbStep.name, url: pageUrl }];
  });
}
