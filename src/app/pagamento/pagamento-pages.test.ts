import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MockCheckoutPage from '../mock-checkout/page';
import PaymentStatusPage from './[status]/page';

describe('payment return pages', () => {
  it('shows a safe test-mode screen for the mock checkout link', async () => {
    const html = renderToStaticMarkup(
      await MockCheckoutPage({
        searchParams: Promise.resolve({ ref: 'comanda:teste-123' }),
      })
    );

    expect(html).toContain('Pagamento em modo de teste');
    expect(html).toContain('Nenhuma cobrança foi realizada');
    expect(html).toContain('comanda:teste-123');
  });

  it.each([
    ['sucesso', 'Pagamento aprovado'],
    ['erro', 'Pagamento não concluído'],
    ['pendente', 'Pagamento pendente'],
  ])('shows the %s return without a 404', async (status, heading) => {
    const html = renderToStaticMarkup(
      await PaymentStatusPage({ params: Promise.resolve({ status }) })
    );

    expect(html).toContain(heading);
    expect(html).toContain('barbearia');
  });
});
