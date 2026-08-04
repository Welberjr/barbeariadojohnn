/**
 * A marca da barbearia que esta na tela.
 *
 * O sistema nasceu para uma barbearia so, e o nome dela estava escrito no
 * codigo: no titulo da aba, no manifesto do aplicativo, dentro do desenho da
 * logo. Funcionava, e impedia vender o mesmo sistema para outra barbearia sem
 * um "localizar e substituir" que sempre esquece algum lugar.
 *
 * Agora o nome, a logo e a cor vem do cadastro da loja. Trocar de dono e trocar
 * uma linha no banco, nao um commit.
 *
 * O EMBLEMA (bigode e tesoura) continua desenhado no codigo de proposito: ele
 * nao e do Johnn, e de barbearia. Serve de marca padrao para quem ainda nao
 * subiu a propria logo, que e o estado de todo cliente no primeiro dia.
 */
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { lojaAtual, lojaPadrao } from '@/lib/loja';
import { MARCA_PADRAO, type Marca } from '@/lib/marca-nome';

export { MARCA_PADRAO, nomeEmDuasLinhas, type Marca } from '@/lib/marca-nome';

async function buscar(id: string): Promise<Marca> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('barbershops')
      .select('name, logo_url, primary_color, address_city, phone')
      .eq('id', id)
      .maybeSingle();

    if (!data) return MARCA_PADRAO;

    return {
      nome: (data.name as string) ?? MARCA_PADRAO.nome,
      logoUrl: (data.logo_url as string) ?? null,
      cor: (data.primary_color as string) ?? null,
      cidade: (data.address_city as string) ?? null,
      telefone: (data.phone as string) ?? null,
    };
  } catch {
    // Marca e enfeite: nenhuma tela pode quebrar por causa dela
    return MARCA_PADRAO;
  }
}

/** A marca da loja de quem esta logado. */
export const marcaAtual = cache(async function marcaAtual(): Promise<Marca> {
  return buscar(await lojaAtual());
});

/** A marca de quem nao esta logado: login, cadastro, cardapio publico. */
export const marcaPadrao = cache(async function marcaPadrao(): Promise<Marca> {
  return buscar(await lojaPadrao());
});

/*
 * A quebra do nome em duas linhas mora em marca-nome.ts, que nao conhece banco
 * nem sessao: a logo aparece dentro de componente que roda no navegador.
 */
