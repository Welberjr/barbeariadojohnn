import { describe, it, expect } from 'vitest';
import {
  validarJornada,
  paraHorarioSemanal,
  daJornadaGravada,
  resumoDaJornada,
  JORNADA_PADRAO,
  type JornadaSimples,
} from './jornada';

function jornada(over: Partial<JornadaSimples> = {}): JornadaSimples {
  return { ...JORNADA_PADRAO, ...over };
}

describe('validarJornada', () => {
  it('aceita a jornada padrão', () => {
    expect(validarJornada(jornada())).toBeNull();
  });

  it('recusa fim antes do começo', () => {
    expect(validarJornada(jornada({ semanaAbre: '18:00', semanaFecha: '09:00' }))).toMatch(
      /Semana/
    );
  });

  it('recusa hora escrita errada', () => {
    expect(validarJornada(jornada({ sabadoAbre: '25:00' }))).toMatch(/Sábado/);
  });

  it('não cobra horário de quem folga no dia', () => {
    expect(
      validarJornada(jornada({ sabadoFolga: true, sabadoAbre: '', sabadoFecha: '' }))
    ).toBeNull();
  });

  it('aceita almoço dentro do expediente', () => {
    expect(validarJornada(jornada({ almocoInicio: '12:00', almocoFim: '13:00' }))).toBeNull();
  });

  it('recusa almoço com só uma ponta preenchida', () => {
    expect(validarJornada(jornada({ almocoInicio: '12:00' }))).toMatch(/Almoço/);
  });

  it('recusa almoço fora do horário de trabalho', () => {
    expect(
      validarJornada(jornada({ almocoInicio: '07:00', almocoFim: '08:00' }))
    ).toMatch(/dentro do horário/);
  });

  it('recusa almoço invertido', () => {
    expect(
      validarJornada(jornada({ almocoInicio: '14:00', almocoFim: '13:00' }))
    ).toMatch(/depois do começo/);
  });
});

describe('paraHorarioSemanal', () => {
  it('espalha o horário de semana pelos cinco dias', () => {
    const h = paraHorarioSemanal(jornada({ semanaAbre: '10:00', semanaFecha: '19:00' }));
    for (const dia of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
      expect(h[dia]).toEqual({ open: '10:00', close: '19:00', closed: false });
    }
  });

  it('domingo de folga vira dia fechado', () => {
    const h = paraHorarioSemanal(jornada({ domingoFolga: true }));
    expect(h.sunday).toEqual({ closed: true });
  });

  it('sábado tem horário próprio', () => {
    const h = paraHorarioSemanal(jornada({ sabadoAbre: '09:00', sabadoFecha: '14:00' }));
    expect(h.saturday).toEqual({ open: '09:00', close: '14:00', closed: false });
  });
});

describe('daJornadaGravada', () => {
  it('ida e volta preserva o que foi escolhido', () => {
    const original = jornada({
      semanaAbre: '10:00',
      semanaFecha: '19:00',
      sabadoAbre: '08:00',
      sabadoFecha: '14:00',
      domingoFolga: true,
      almocoInicio: '12:30',
      almocoFim: '13:30',
    });

    const volta = daJornadaGravada(paraHorarioSemanal(original), {
      inicio: '12:30',
      fim: '13:30',
    });

    expect(volta).toEqual(original);
  });

  it('sem nada gravado, cai no padrão da casa', () => {
    expect(daJornadaGravada(null, { inicio: null, fim: null })).toEqual(JORNADA_PADRAO);
  });

  it('aceita hora vinda do banco com segundos', () => {
    const j = daJornadaGravada(null, { inicio: '12:00:00', fim: '13:00:00' });
    expect(j.almocoInicio).toBe('12:00');
    expect(j.almocoFim).toBe('13:00');
  });
});

describe('resumoDaJornada', () => {
  it('quem segue a loja não mostra horário próprio', () => {
    expect(resumoDaJornada(jornada(), true)).toBe('Segue o horário da barbearia');
  });

  it('mostra semana, sábado e almoço', () => {
    const texto = resumoDaJornada(
      jornada({ almocoInicio: '12:00', almocoFim: '13:00' }),
      false
    );
    expect(texto).toContain('Semana 09:00 às 20:00');
    expect(texto).toContain('sábado');
    expect(texto).toContain('almoço 12:00 às 13:00');
  });
});
