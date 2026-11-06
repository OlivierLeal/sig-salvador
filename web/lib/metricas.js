export const METRICAS = [
  {
    id: "pct_negra",
    rotulo: "% população negra",
    curto: "Pop. negra",
    unidade: "%",
    descricao: "Pretos + pardos sobre o total por cor ou raça.",
  },
  {
    id: "pct_resp_mulher",
    rotulo: "% domicílios chefiados por mulheres",
    curto: "Chefia feminina",
    unidade: "%",
    descricao: "Responsáveis do sexo feminino sobre o total de responsáveis.",
  },
  {
    id: "renda_mediana",
    rotulo: "Renda mediana do responsável",
    curto: "Renda mediana",
    unidade: "R$",
    descricao: "Mediana do rendimento mensal dos responsáveis com renda. Fora do setor, média ponderada pelas medianas.",
  },
  {
    id: "taxa_analf",
    rotulo: "Taxa de analfabetismo (15+)",
    curto: "Analfabetismo",
    unidade: "%",
    usaGrupo: true,
    descricao: "Pessoas de 15 anos ou mais que não sabem ler e escrever. Respeita o filtro de sexo e raça.",
  },
  {
    id: "gap_analf_pp",
    rotulo: "Gap de analfabetismo: mulher negra − homem branco",
    curto: "Gap analfab.",
    unidade: "pp",
    divergente: true,
    descricao: "Diferença em pontos percentuais entre as taxas de analfabetismo.",
  },
  {
    id: "saneamento",
    rotulo: "Domicílios com saneamento adequado",
    curto: "Saneamento",
    unidade: "%",
    usaGrupo: true,
    usaTema: true,
    descricao: "Por sexo OU raça do responsável (o IBGE não cruza os dois).",
  },
  {
    id: "gap_esgoto_pp",
    rotulo: "Gap de esgoto: responsável branco − negro",
    curto: "Gap esgoto",
    unidade: "pp",
    divergente: true,
    descricao: "Diferença em pontos percentuais no acesso a esgoto por rede.",
  },
  {
    id: "ndvi_medio",
    rotulo: "NDVI médio (vegetação)",
    curto: "NDVI",
    unidade: "ndvi",
    descricao: "Média dos pixels de 30 m. Valores acima de 0,3 indicam vegetação.",
  },
  {
    id: "pct_vegetacao",
    rotulo: "% da área com vegetação",
    curto: "Vegetação",
    unidade: "%",
    descricao: "Pixels com NDVI ≥ 0,3.",
  },
  {
    id: "pct_grupo",
    rotulo: "% da população no grupo selecionado",
    curto: "Grupo",
    unidade: "%",
    usaGrupo: true,
    descricao: "Participação do grupo de sexo e raça escolhido na população.",
  },
  {
    id: "populacao",
    rotulo: "População",
    curto: "População",
    unidade: "pessoas",
    descricao: "Total de pessoas por cor ou raça (sem as células em sigilo).",
  },
];

export const METRICA = Object.fromEntries(METRICAS.map((m) => [m.id, m]));

export const TEMAS = {
  esgoto_rede: "Esgoto por rede",
  agua_rede: "Água da rede geral",
  agua_encanada: "Água encanada dentro de casa",
  banheiro: "Banheiro de uso exclusivo",
  lixo_coletado: "Lixo coletado",
};

export const SEXOS = { 0: "Todos os sexos", 1: "Homens", 2: "Mulheres" };
export const RACAS = {
  0: "Todas as raças",
  6: "Negra (preta + parda)",
  1: "Branca",
  2: "Preta",
  4: "Parda",
  3: "Amarela",
  5: "Indígena",
};

export function formatar(valor, unidade) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "sem dado";
  switch (unidade) {
    case "%":
      return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "pp":
      return `${valor > 0 ? "+" : ""}${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
    case "R$":
      return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    case "ndvi":
      return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return Math.round(valor).toLocaleString("pt-BR");
  }
}
