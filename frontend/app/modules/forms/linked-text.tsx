import { splitLinks } from './linkify.ts';

export function LinkedText({ children }: { children: string }) {
  return splitLinks(children).map((part, index) =>
    part.href ? (
      <a
        key={index}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 [overflow-wrap:anywhere] hover:opacity-80"
      >
        {part.text}
      </a>
    ) : (
      part.text
    )
  );
}
