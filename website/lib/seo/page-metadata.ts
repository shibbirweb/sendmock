import type { Metadata } from "next";

import { resolvePageIndexing, rootPagePaths } from "@/lib/seo/page-indexing";
import {
  buildSiteFileUrl,
  buildSiteUrl,
  buildVersionFileUrl,
  buildVersionPageUrl,
} from "@/lib/seo/site-url";

export const siteName = "SendMock";

/** The 1200x630 link preview images in public/social/. */
export const socialImages = {
  landing: {
    filePath: "social/sendmock.png",
    alt: "SendMock: catch every email, SMS, payment and webhook on your machine",
  },
  docs: {
    filePath: "social/sendmock-docs.png",
    alt: "SendMock docs: guides, API, CLI and MCP reference",
  },
} as const;

export type SocialImageKey = keyof typeof socialImages;

export type PageMetadataInput = {
  /** The page's own title; the layout's template adds " | SendMock". */
  title: string;
  description: string;
  /** The page's path under the site root, such as "/docs/install". */
  pagePath: string;
  socialImage?: SocialImageKey;
  /** Used as it is, without the template (the landing page). */
  isAbsoluteTitle?: boolean;
};

/**
 * Canonical (or noindex, see page-indexing.ts), Open Graph and Twitter tags
 * for one page. Next replaces a
 * layout's `alternates` and `openGraph` with the page's instead of merging
 * them, so every page gets all of them from here.
 */
export function buildPageMetadata(
  pageMetadataInput: PageMetadataInput,
): Metadata {
  const {
    title,
    description,
    pagePath,
    socialImage = "docs",
    isAbsoluteTitle = false,
  } = pageMetadataInput;
  const isCanonical =
    resolvePageIndexing(pagePath, rootPagePaths) === "canonical";
  const canonicalUrl = buildSiteUrl(pagePath);
  const fullTitle = isAbsoluteTitle ? title : `${title} | ${siteName}`;
  const image = socialImages[socialImage];
  const imageUrl = buildSiteFileUrl(image.filePath);

  return {
    title: isAbsoluteTitle ? { absolute: title } : title,
    description,
    // A page only this docs version has: out of search, its links still followed.
    ...(isCanonical ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      ...(isCanonical ? { canonical: canonicalUrl } : {}),
      // Agents given only the site's address find the docs and install steps (WS-09.4).
      types: { "text/plain": buildVersionFileUrl("llms.txt") },
    },
    openGraph: {
      type: "website",
      siteName,
      locale: "en_US",
      url: isCanonical ? canonicalUrl : buildVersionPageUrl(pagePath),
      title: fullTitle,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: image.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: imageUrl, alt: image.alt }],
    },
  };
}
