import { METRICA, TEMAS, formatar } from "@/lib/metricas";

const LINHAS = [
  "populacao",
  "pct_negra",
  "pct_resp_mulher",
  "renda_mediana",
  "taxa_analf",
  "gap_analf_pp",
  "saneamento",
  "gap_esgoto_pp",
  "ndvi_medio",
];

export default function Kpis({ resumo, ativa, tema, grupo, onEscolher }) {
  return (
    <div className="ficha">
      <div className="ficha-cabecalho">
        <span>Indicador</span>
        <span>Recorte</span>
        <span>Favelas</span>
        <span>Fora</span>
      </div>
      {LINHAS.map((id) => {
        const m = METRICA[id];
        const v = (r) => (r ? formatar(r[id], m.unidade) : "…");
        let rotulo = id === "saneamento" ? TEMAS[tema] : m.curto;
        if (m.usaGrupo && grupo) rotulo += `, ${grupo.toLowerCase()}`;
        return (
          <button
            key={id}
            type="button"
            className={`ficha-linha${ativa === id ? " ativa" : ""}`}
            onClick={() => onEscolher(id)}
            aria-pressed={ativa === id}
            title={`${m.descricao} Clique para ver no mapa.`}
          >
            <span className="ficha-rotulo">{rotulo}</span>
            <span className="ficha-valor">{v(resumo?.selecao)}</span>
            <span className="ficha-comp">{v(resumo?.favela)}</span>
            <span className="ficha-comp">{v(resumo?.naoFavela)}</span>
          </button>
        );
      })}
    </div>
  );
}
