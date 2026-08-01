import { describe, it, expect } from 'vitest';
import {
  quandoEmPalavras,
  avisoDeHorarioMarcado,
  avisoDeHorarioDesmarcado,
  desdeQuandoOlhar,
  haQuantoTempo,
} from './avisos';

describe('quando em palavras', () => {
  it('fala no fuso da barbearia, nao no do servidor', () => {
    // 14:30 em Brasília é 17:30 UTC
    expect(quandoEmPalavras('2026-08-03T17:30:00.000Z')).toBe('03/08 às 14:30');
  });

  it('vira o dia certo na virada da meia-noite', () => {
    // 02:00 UTC do dia 4 ainda é 23:00 do dia 3 em Brasília
    expect(quandoEmPalavras('2026-08-04T02:00:00.000Z')).toBe('03/08 às 23:00');
  });
});

describe('aviso de horario marcado pela barbearia', () => {
  it('diz o que, com quem e quando', () => {
    const aviso = avisoDeHorarioMarcado({
      servico: 'Corte',
      profissional: 'Johnn',
      quandoISO: '2026-08-03T17:30:00.000Z',
    });
    expect(aviso.corpo).toContain('Corte');
    expect(aviso.corpo).toContain('Johnn');
    expect(aviso.corpo).toContain('03/08 às 14:30');
  });

  it('sempre oferece a saida, para o horario nao virar falta', () => {
    const aviso = avisoDeHorarioMarcado({ quandoISO: '2026-08-03T17:30:00.000Z' });
    expect(aviso.corpo).toContain('desmarcar');
  });

  it('funciona sem servico e sem profissional', () => {
    const aviso = avisoDeHorarioMarcado({
      servico: null,
      profissional: null,
      quandoISO: '2026-08-03T17:30:00.000Z',
    });
    expect(aviso.corpo).toContain('Seu horário');
    expect(aviso.corpo).not.toContain('com null');
    expect(aviso.corpo).not.toContain('undefined');
  });
});

describe('aviso de horario desmarcado', () => {
  it('conta o motivo quando existe', () => {
    const aviso = avisoDeHorarioDesmarcado({
      quandoISO: '2026-08-03T17:30:00.000Z',
      motivo: 'barbeiro passou mal',
    });
    expect(aviso.corpo).toContain('barbeiro passou mal');
  });

  it('sem motivo, nao deixa frase pela metade', () => {
    const aviso = avisoDeHorarioDesmarcado({ quandoISO: '2026-08-03T17:30:00.000Z' });
    expect(aviso.corpo).not.toContain(': .');
    expect(aviso.corpo).toContain('remarcar');
  });

  it('motivo em branco conta como sem motivo', () => {
    const emBranco = avisoDeHorarioDesmarcado({
      quandoISO: '2026-08-03T17:30:00.000Z',
      motivo: '   ',
    });
    const semMotivo = avisoDeHorarioDesmarcado({ quandoISO: '2026-08-03T17:30:00.000Z' });
    expect(emBranco.corpo).toBe(semMotivo.corpo);
  });
});

describe('desde quando olhar', () => {
  const agora = new Date('2026-08-01T12:00:00.000Z');

  it('sem marca nenhuma, olha as ultimas 48h', () => {
    expect(desdeQuandoOlhar(null, agora)).toBe('2026-07-30T12:00:00.000Z');
  });

  it('usa a ultima vez que a pessoa abriu', () => {
    expect(desdeQuandoOlhar('2026-08-01T09:00:00.000Z', agora)).toBe(
      '2026-08-01T09:00:00.000Z'
    );
  });

  it('quem sumiu uma semana nao recebe a semana inteira de uma vez', () => {
    expect(desdeQuandoOlhar('2026-07-25T09:00:00.000Z', agora)).toBe(
      '2026-07-30T12:00:00.000Z'
    );
  });

  it('marca do futuro (relogio errado) nao esconde tudo para sempre', () => {
    expect(desdeQuandoOlhar('2026-12-01T00:00:00.000Z', agora)).toBe(
      '2026-08-01T12:00:00.000Z'
    );
  });

  it('marca sem sentido cai no padrao', () => {
    expect(desdeQuandoOlhar('banana', agora)).toBe('2026-07-30T12:00:00.000Z');
  });
});

describe('ha quanto tempo', () => {
  const agora = new Date('2026-08-01T12:00:00.000Z');

  it('conta minutos, horas e dias', () => {
    expect(haQuantoTempo('2026-08-01T11:55:00.000Z', agora)).toBe('há 5 min');
    expect(haQuantoTempo('2026-08-01T09:00:00.000Z', agora)).toBe('há 3h');
    expect(haQuantoTempo('2026-07-31T09:00:00.000Z', agora)).toBe('ontem');
    expect(haQuantoTempo('2026-07-29T09:00:00.000Z', agora)).toBe('há 3 dias');
  });

  it('o que acabou de acontecer nao vira "há 0 min"', () => {
    expect(haQuantoTempo('2026-08-01T11:59:40.000Z', agora)).toBe('agora');
  });
});
