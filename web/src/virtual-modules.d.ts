/** The repository's CHANGELOG.md as text, served by `serveChangelogModule` in vite.config.ts. */
declare module "virtual:sendmock-changelog" {
  const changelogMarkdown: string;
  export default changelogMarkdown;
}
