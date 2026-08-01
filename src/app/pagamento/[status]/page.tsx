import Link from 'next/link';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import React from 'react';

interface PaymentStatusPageProps {
  params: Promise<{ status: string }>;
}

const STATUS = {
  sucesso: {
    title: 'Pagamento aprovado',
    message: 'Recebemos a confirmação do seu pagamento. Obrigado por escolher a barbearia.',
    Icon: CheckCircle2,
    iconClass: 'bg-success/15 text-success',
  },
  pendente: {
    title: 'Pagamento pendente',
    message: 'Seu pagamento ainda está sendo confirmado. Assim que houver uma atualização, a barbearia será avisada.',
    Icon: Clock3,
    iconClass: 'bg-gold/15 text-gold',
  },
  erro: {
    title: 'Pagamento não concluído',
    message: 'Não foi possível concluir o pagamento. Você pode tentar novamente ou falar com a barbearia.',
    Icon: XCircle,
    iconClass: 'bg-danger/15 text-danger',
  },
} as const;

export default async function PaymentStatusPage({ params }: PaymentStatusPageProps) {
  const { status } = await params;
  const content = STATUS[status as keyof typeof STATUS] ?? STATUS.erro;
  const Icon = content.Icon;

  return (
    <main className="min-h-screen bg-bg px-5 py-10 text-fg sm:flex sm:items-center sm:justify-center">
      <section className="card mx-auto max-w-md space-y-5 p-6 text-center sm:p-8">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${content.iconClass}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.24em] text-gold">BARBEARIA DO JOHNN</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            {content.title}
          </h1>
          <p className="text-sm leading-6 text-fg-muted">{content.message}</p>
        </div>
        <Link href="/" className="btn-gold-shimmer inline-flex w-full justify-center">
          Voltar para a barbearia
        </Link>
      </section>
    </main>
  );
}
