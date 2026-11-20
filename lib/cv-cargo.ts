/**
 * Onde cada cargo aparece no texto do CV completo (linha do tempo, PR c; CV por vaga, 2026-11-20).
 * Sem dependências, para servir à tela e ao servidor.
 */
type CargoRef = { cargo: string; empresa: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Linha do CV onde o cargo começa. Primeiro, uma linha da empresa com o título do cargo nela ou nas
 * 3 linhas seguintes (vários cargos na mesma empresa); depois a primeira linha da empresa; por fim,
 * a primeira com o título. Sem acento e sem diferença de maiúscula.
 */
export function linhaDoCargo(linhas: string[], cargo: CargoRef): number {
  const ls = linhas.map(norm);
  const empresa = norm(cargo.empresa);
  const titulo = norm(cargo.cargo);
  const temEmpresa = empresa.length >= 2 ? ls.flatMap((l, i) => (l.includes(empresa) ? [i] : [])) : [];
  if (titulo.length >= 2) {
    for (const i of temEmpresa) {
      for (let j = Math.max(0, i - 3); j <= Math.min(ls.length - 1, i + 3); j++) if (ls[j].includes(titulo)) return Math.min(i, j);
    }
  }
  if (temEmpresa.length) return temEmpresa[0];
  return titulo.length >= 2 ? ls.findIndex((l) => l.includes(titulo)) : -1;
}

/**
 * Linha onde o texto do cargo começa de fato: a linha do título, se ela vem logo depois da linha
 * achada (vários cargos debaixo do mesmo cabeçalho de empresa); senão, a própria linha achada.
 */
function inicioDoCargo(linhas: string[], cargo: CargoRef): number {
  const l = linhaDoCargo(linhas, cargo);
  if (l < 0) return -1;
  const titulo = norm(cargo.cargo);
  if (titulo.length >= 2) for (let j = l; j <= Math.min(linhas.length - 1, l + 6); j++) if (norm(linhas[j]).includes(titulo)) return j;
  return l;
}

/**
 * Trecho do CV de um cargo: da linha dele até a linha do próximo cargo achado depois dela
 * (no máximo `maxLinhas` linhas e `maxChars` caracteres). "" quando o cargo não aparece no CV ou
 * quando outro cargo começa na mesma linha (não dá para separar: melhor nada do que misturar cargos).
 */
export function trechoDoCargo(texto: string, cargos: CargoRef[], i: number, maxLinhas = 30, maxChars = 900): string {
  if (!texto || !cargos[i]) return "";
  const linhas = texto.split("\n");
  const ini = inicioDoCargo(linhas, cargos[i]);
  if (ini < 0) return "";
  let fim = Math.min(linhas.length, ini + maxLinhas);
  for (let k = 0; k < cargos.length; k++) {
    if (k === i) continue;
    const l = inicioDoCargo(linhas, cargos[k]);
    if (l === ini) return "";
    if (l > ini && l < fim) fim = l;
  }
  return linhas.slice(ini, fim).join("\n").trim().slice(0, maxChars);
}
