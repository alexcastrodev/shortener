import { existsSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type MarkdownIt from 'markdown-it';

// The pages cite code as `path/from/repo/root.rb:LINE`. On the site those
// become links to the file at the commit the page documents (its
// "State as of commit" line), so the line numbers still point at the rule.
// Links that leave wiki/ (../docs, ../SECURITY.md) go to the repository.

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CODE_REF = /^([\w.@$\-[\]/]+\.[A-Za-z0-9]+)(?::(\d+)(?:[-–](\d+))?(?:,[\d\-–]+)*)?$/;
// The first commit a page names is the one in its header.
const STATE_COMMIT = /\bcommit `([0-9a-f]{7,40})`/;

function inRepo(path: string) {
  const full = resolve(REPO_ROOT, path);
  return full.startsWith(REPO_ROOT) && existsSync(full) ? full : null;
}

export function codeLinks(md: MarkdownIt, { repo }: { repo: string }) {
  md.core.ruler.push('code_links', state => {
    const commit = state.src.match(STATE_COMMIT)?.[1] ?? 'main';
    const page = posix.join('wiki', posix.dirname(state.env.relativePath ?? ''));

    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      const children = [];
      let insideLink = 0;

      for (const token of block.children) {
        if (token.type === 'link_open') {
          insideLink++;
          const href = token.attrGet('href') ?? '';
          if (href.startsWith('../')) {
            const [path, hash] = href.split('#');
            const target = posix.normalize(posix.join(page, path));
            const full = inRepo(target);
            if (full) {
              const kind = statSync(full).isDirectory() ? 'tree' : 'blob';
              token.attrSet('href', `${repo}/${kind}/main/${target}${hash ? `#${hash}` : ''}`);
            }
          }
        } else if (token.type === 'link_close') {
          insideLink--;
        }

        // Vue compiles the page: keep `{{placeholders}}` in code as text.
        if (token.type === 'code_inline') token.attrSet('v-pre', '');

        const ref = token.type === 'code_inline' && !insideLink ? token.content.match(CODE_REF) : null;
        if (!ref || !ref[1].includes('/') || !inRepo(ref[1])) {
          children.push(token);
          continue;
        }

        const [, path, start, end] = ref;
        const lines = start ? `#L${start}${end ? `-L${end}` : ''}` : '';
        const open = new state.Token('link_open', 'a', 1);
        open.attrSet('href', `${repo}/blob/${commit}/${path}${lines}`);
        children.push(open, token, new state.Token('link_close', 'a', -1));
      }
      block.children = children;
    }
  });
}

export function mermaidFences(md: MarkdownIt) {
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() !== 'mermaid') return fence(tokens, idx, options, env, self);
    return `<Mermaid code="${encodeURIComponent(token.content)}" />`;
  };
}
