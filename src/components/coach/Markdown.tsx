"use client";

import type { ReactNode } from "react";

/**
 * Tiny safe markdown renderer for Coach replies.
 * Supports: **bold**, *italic*, `code`, paragraphs, blank-line breaks,
 * - / * bullet lists, 1. numbered lists, # / ## / ### headers.
 *
 * Returns real React nodes — no dangerouslySetInnerHTML, no XSS surface.
 */

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) {
      out.push(
        <strong key={key++} className="font-bold text-zinc-900 dark:text-white">
          {t.slice(2, -2)}
        </strong>,
      );
    } else if (t.startsWith("*")) {
      out.push(<em key={key++}>{t.slice(1, -1)}</em>);
    } else {
      out.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700/60 text-[11px] font-mono"
        >
          {t.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = (lines[i] ?? "").trim();

    // Blank lines just create gaps between blocks
    if (!trimmed) {
      i++;
      continue;
    }

    // Unordered list (- foo / * foo)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list (1. foo / 2. bar)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-2 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{inline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Headers (## or ###)
    const h = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (h) {
      const level = h[1]!.length;
      const content = h[2]!;
      const sizeClass = level === 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm";
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(
        <Tag
          key={key++}
          className={`font-bold text-zinc-900 dark:text-white ${sizeClass} mt-3 first:mt-0`}
        >
          {inline(content)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Paragraph — collect adjacent plain lines until a blank or a block trigger
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^[-*]\s+/.test((lines[i] ?? "").trim()) &&
      !/^\d+\.\s+/.test((lines[i] ?? "").trim()) &&
      !/^#{1,3}\s+/.test((lines[i] ?? "").trim())
    ) {
      para.push((lines[i] ?? "").trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">
        {inline(para.join(" "))}
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}
