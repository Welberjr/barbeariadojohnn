'use client';

import dynamic from 'next/dynamic';

export const ChatFloatLazy = dynamic(
  () => import('./chat-float').then((module) => module.ChatFloat),
  { ssr: false }
);
