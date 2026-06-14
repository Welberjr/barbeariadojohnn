'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown, { type Components } from 'react-markdown';

type MdProps = { children?: React.ReactNode };

function nodeToText(node: React.ReactNode): string {
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
    const t = nodeToText(children).trim();
    let cls = 'border-info bg-info/10';
    if (/^(\u2705|\ud83d\udc4d|\ud83c\udf89|\ud83d\udcc8|\ud83d\udfe2)/.test(t)) cls = 'border-success bg-success/10';
    else if (/^(\u26a0|\ud83d\udea8|\u274c|\ud83d\udcc9|\ud83d\udd34)/.test(t)) cls = 'border-danger bg-danger/10';
    else if (/^(\ud83d\udca1|\ud83d\udfe1|\u2b50)/.test(t)) cls = 'border-gold bg-gold/10';
    return (
      <div className={cn('not-prose border-l-4 rounded-md px-3 py-2 my-2 text-fg text-sm [&_p]:m-0', cls)}>
        {children}
      </div>
    );
  },
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatFloatProps {
  endpoint: '/api/chat/cliente' | '/api/chat/admin';
  welcomeMessage: string;
  placeholder?: string;
  accentColor?: string;
  title?: string;
  avatarSrc?: string;
}

export function ChatFloat({
  endpoint,
  welcomeMessage,
  placeholder = 'Digite sua mensagem...',
  accentColor = '#F5C518',
  title = 'Assistente',
  avatarSrc,
}: ChatFloatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      inputRef.current?.focus();
    }
  }, [open, messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? 'Desculpe, tive um problema.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <>
      {/* Bolinha flutuante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-20 right-3 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all',
          open ? 'scale-90' : 'hover:scale-110'
        )}
        style={{ background: `linear-gradient(135deg, #B8862A, ${accentColor})` }}
        aria-label={open ? 'Fechar chat' : 'Abrir assistente'}
      >
        {open ? <X className="w-4 h-4 text-bg" /> : (avatarSrc ? <img src={avatarSrc} alt={title} className="w-full h-full rounded-full object-cover" /> : <MessageCircle className="w-4 h-4 text-bg" />)}
        {/* Pulse quando fechado */}
        {!open && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: accentColor }} />
        )}
      </button>

      {/* Painel de chat */}
      {open && (
        <div
          className="fixed bottom-32 right-3 md:bottom-24 md:right-6 z-50 w-[calc(100vw-1.5rem)] max-w-sm bg-bg border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 'min(520px, calc(100vh - 10rem))', animation: 'slideUp 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0d0d0d, #1a1204)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, #B8862A, ${accentColor})` }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt={title} className="w-full h-full rounded-full object-cover" />
              ) : (
                <Scissors className="w-4 h-4 text-bg" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-fg">{title}</p>
              <p className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Online agora
              </p>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'text-bg rounded-br-sm'
                      : 'bg-bg-elevated border border-border/50 text-fg rounded-bl-sm'
                  )}
                  style={m.role === 'user' ? { background: `linear-gradient(135deg, #B8862A, ${accentColor})` } : {}}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none text-fg [&>p]:mb-1.5 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&>h3]:text-gold [&>h3]:mb-1 [&>table]:text-xs [&>strong]:text-fg">
                      <ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-elevated border border-border/50 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border/60 flex items-end gap-2 flex-shrink-0">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={placeholder}
              className="flex-1 resize-none bg-bg-elevated border border-border/60 rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-gold/50 transition-colors min-h-[40px] max-h-[100px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
              disabled={loading}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, #B8862A, ${accentColor})` }}
            >
              {loading ? <Loader2 className="w-4 h-4 text-bg animate-spin" /> : <Send className="w-4 h-4 text-bg" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}