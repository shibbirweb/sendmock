import { createMDX } from "fumadocs-mdx/next";

// GitHub Pages serves the site under /<repository>/, set by the Website workflow.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Our root AGENTS.md already covers AI agents; stop `next dev` writing website/AGENTS.md.
  agentRules: false,
};

const withMDX = createMDX();

export default withMDX(nextConfig);
