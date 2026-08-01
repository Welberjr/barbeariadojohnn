import { describe, it, expect } from 'vitest';
import {
  ritmoDoCliente,
  calcularAtraso,
  ordenarPorUrgencia,
  resumoDaAusencia,
  linkWhatsApp,
  ritmoEmPalavras,
  diasEntre,
  type ClienteSumido,
} from './clientes-sumidos';

function cliente(over: Partial<ClienteSumido> = {}): ClienteSumido {
  return {
    id: 'c1',
    nome: 'João da Silva',
    telefone: '61999998888',
    ultimaVisita: '2026-05-01',
    diasSemVir: 60,
    ritmoDias: 30,
    atraso: 2,
    visitas: 10,
    totalGasto: 500,
    servicoHabitual: 'Corte',
    contatadoEm: null,
    ...over,
  };
}

describe('ritmoDoCliente', () => {
  it('quem vem toda semana tem ritmo de 7 dias', () => {
    expect(ritmoDoCliente(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22'])).toBe(7);
  });

  it('uma sumida no meio não estraga o ritmo, porque usa mediana', () => {
    // vinha a cada 15 dias, sumiu 6 meses uma vez, e voltou ao ritmo
    const datas = ['2026-01-01', '2026-01-15', '2026-01-30', '2026-07-30', '2026-08-14'];
    const ritmo = ritmoDoCliente(datas);
    expect(ritmo).toBeLessThan(30); // média daria mais de 60
  });

  it('quem veio uma vez só não tem ritmo', () => {
    expect(ritmoDoCliente(['2026-06-01'])).toBeNull();
    expect(ritmoDoCliente([])).toBeNull();
  });

  it('duas visitas não são ritmo, são coincidência', () => {
    // Veio segunda e terça: isso não faz dele alguém que "vem todo dia"
    expect(ritmoDoCliente(['2026-06-01', '2026-06-02'])).toBeNull();
  });

  it('duas visitas no mesmo dia não viram ritmo zero', () => {
    expect(ritmoDoCliente(['2026-06-01', '2026-06-01'])).toBeNull();
  });
});

describe('calcularAtraso', () => {
  it('o dobro do ritmo dá atraso 2', () => {
    expect(calcularAtraso(60, 30, 45)).toBe(2);
  });

  it('quem está no ritmo dá atraso 1', () => {
    expect(calcularAtraso(30, 30, 45)).toBe(1);
  });

  it('sem ritmo conhecido, usa o padrão da casa', () => {
    expect(calcularAtraso(90, null, 45)).toBe(2);
  });
});

describe('ordenarPorUrgencia', () => {
  it('quem nunca foi chamado vem antes de quem já foi', () => {
    const lista = [
      cliente({ id: 'ja-chamado', atraso: 9, contatadoEm: '2026-07-30' }),
      cliente({ id: 'novo', atraso: 2, contatadoEm: null }),
    ];
    expect(ordenarPorUrgencia(lista)[0].id).toBe('novo');
  });

  it('entre os não chamados, o mais atrasado vem primeiro', () => {
    const lista = [cliente({ id: 'pouco', atraso: 1.5 }), cliente({ id: 'muito', atraso: 4 })];
    expect(ordenarPorUrgencia(lista)[0].id).toBe('muito');
  });

  it('empate no atraso decide por quem gastou mais', () => {
    const lista = [
      cliente({ id: 'pequeno', atraso: 3, totalGasto: 100 }),
      cliente({ id: 'grande', atraso: 3, totalGasto: 2000 }),
    ];
    expect(ordenarPorUrgencia(lista)[0].id).toBe('grande');
  });
});

describe('resumoDaAusencia', () => {
  it('fala em dias quando é recente', () => {
    expect(resumoDaAusencia(cliente({ diasSemVir: 45 }))).toBe('há 45 dias');
  });

  it('fala em meses a partir de dois meses', () => {
    expect(resumoDaAusencia(cliente({ diasSemVir: 90 }))).toBe('há 3 meses');
  });

  it('fala em anos quando passa de um ano', () => {
    expect(resumoDaAusencia(cliente({ diasSemVir: 400 }))).toBe('há mais de 1 ano');
    expect(resumoDaAusencia(cliente({ diasSemVir: 800 }))).toBe('há mais de 2 anos');
  });
});

describe('linkWhatsApp', () => {
  it('monta o link com mensagem pronta e primeiro nome', () => {
    const url = linkWhatsApp(cliente(), 'Barbearia do Johnn');
    expect(url).toContain('wa.me/5561999998888');
    expect(decodeURIComponent(url!)).toContain('Oi, João!');
    expect(decodeURIComponent(url!)).toContain('corte');
  });

  it('não repete o código do país quando já vem no número', () => {
    const url = linkWhatsApp(cliente({ telefone: '5561999998888' }), 'Barbearia');
    expect(url).toContain('wa.me/5561999998888');
  });

  it('cliente sem telefone não gera link', () => {
    expect(linkWhatsApp(cliente({ telefone: null }), 'Barbearia')).toBeNull();
    expect(linkWhatsApp(cliente({ telefone: '123' }), 'Barbearia')).toBeNull();
  });
});

describe('diasEntre', () => {
  it('conta os dias entre duas datas', () => {
    expect(diasEntre('2026-07-01', '2026-07-31')).toBe(30);
  });
});

describe('ritmoEmPalavras', () => {
  it('não escreve "a cada 1 dias"', () => {
    expect(ritmoEmPalavras(1)).toBe('vinha quase todo dia');
  });

  it('fala em semana quando o intervalo é de semana', () => {
    expect(ritmoEmPalavras(7)).toBe('vinha toda semana');
    expect(ritmoEmPalavras(8)).toBe('vinha toda semana');
  });

  it('fala em quinzena e em mês', () => {
    expect(ritmoEmPalavras(15)).toBe('vinha de quinze em quinze dias');
    expect(ritmoEmPalavras(30)).toBe('vinha uma vez por mês');
  });

  it('quem não tem ritmo conhecido não ganha frase', () => {
    expect(ritmoEmPalavras(null)).toBeNull();
    expect(ritmoEmPalavras(0)).toBeNull();
  });

  it('nunca devolve texto com número no plural errado', () => {
    for (let d = 1; d <= 400; d++) {
      const texto = ritmoEmPalavras(d);
      expect(texto).not.toMatch(/\b1 dias\b/);
    }
  });
});
