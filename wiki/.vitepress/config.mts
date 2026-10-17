import { defineConfig } from 'vitepress';
import { codeLinks, mermaidFences } from './code-links';

const repo = 'https://github.com/alexcastrodev/shortener';

export default defineConfig({
  title: 'Kurz wiki',
  description: 'Business rules and decisions of the Kurz application',
  lang: 'en',
  // GitHub Pages serves the project under /<repo>/; the workflow passes the
  // path Pages reports, so a custom domain works without a change here.
  base: process.env.WIKI_BASE || '/',
  cleanUrls: true,
  rewrites: { 'README.md': 'index.md' },
  markdown: {
    config: md => {
      // The pages are plain Markdown: `<id>` or `<slug>` in prose is text, not a tag.
      md.disable(['html_inline', 'html_block']);
      md.use(codeLinks, { repo });
      md.use(mermaidFences);
    },
  },
  themeConfig: {
    nav: [
      { text: 'Index', link: '/' },
      { text: 'Impact map', link: '/#cross-domain-impact-map' },
    ],
    sidebar: [
      { text: 'Start here', items: [{ text: 'Index and impact map', link: '/' }] },
      {
        text: 'Domains',
        items: [
          { text: 'Short links', link: '/shortlinks' },
          { text: 'Accounts and authentication', link: '/accounts-and-auth' },
          { text: 'Bio pages', link: '/bio-pages' },
          { text: 'Forms', link: '/forms' },
          { text: 'Booking engine', link: '/booking-engine' },
          { text: 'Appointments lifecycle', link: '/appointments-lifecycle' },
          { text: 'Use cases: form and agenda', link: '/use-cases' },
          { text: 'Notifications and e-mail', link: '/notifications-and-email' },
          { text: 'MCP and OAuth', link: '/mcp-and-oauth' },
          { text: 'Admin and moderation', link: '/admin-and-moderation' },
        ],
      },
      {
        text: 'Cross-cutting',
        items: [
          { text: 'Data model', link: '/data-model' },
          { text: 'Platform and operations', link: '/platform-and-operations' },
          { text: 'Frontend architecture', link: '/frontend-architecture' },
        ],
      },
    ],
    outline: { level: [2, 3] },
    search: { provider: 'local' },
    editLink: { pattern: `${repo}/edit/main/wiki/:path`, text: 'Edit this page' },
    socialLinks: [{ icon: 'github', link: repo }],
  },
});
