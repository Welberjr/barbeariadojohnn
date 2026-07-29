'use client';

import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { cn } from '@/lib/utils';

type MdProps = { children?: ReactNode };

function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return nodeToText((node as { props?: MdProps }).props?.children);
  }
  return '';
}

const mdComponents: Components = {
  blockquote({ children }) {
    const text = nodeToText(children).trim();
    let className = 'border-info bg-info/10';
    if (/^(\u2705|\ud83d\udc4d|\ud83c\udf89|\ud83d\udcc8|\ud83d\udfe2|\ud83c\udfc6|\ud83e\udd47|\ud83c\udf1f|\u2b50)/.test(text)) className = 'border-success bg-success/10';
    else if (/^(\u26a0|\ud83d\udea8|\u274c|\ud83d\udcc9|\ud83d\udd34)/.test(text)) className = 'border-danger bg-danger/10';
    else if (/^(\ud83d\udca1|\ud83d\udfe1|\u2b50)/.test(text)) className = 'border-gold bg-gold/10';

    return (
      <div className={cn('not-prose border-l-4 rounded-md px-3 py-2 my-2 text-fg text-sm [&_p]:m-0', className)}>
        {children}
      </div>
    );
  },
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-fg [&>p]:mb-1.5 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&>h3]:text-gold [&>h3]:mb-1 [&>table]:text-xs [&>strong]:text-fg">
      <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
    </div>
  );
}
