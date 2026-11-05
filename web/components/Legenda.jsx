import { formatar } from "@/lib/metricas";

export default function Legenda({ classes, unidade, titulo }) {
  if (!classes.limites.length) return null;
  return (
    <div className="legenda" aria-label={`Legenda: ${titulo}`}>
      <span className="legenda-titulo">{titulo}</span>
      <div className="legenda-faixas">
        {classes.cores.map((cor, i) => (
          <span key={cor + i} className="legenda-faixa" style={{ background: cor }} />
        ))}
      </div>
      <div className="legenda-rotulos" style={{ gridTemplateColumns: `repeat(${classes.cores.length}, 1fr)` }}>
        {classes.limites.map((l, i) => (
          <span key={i} style={{ gridColumn: i + 1 }} className="legenda-limite">
            {formatar(l, unidade)}
          </span>
        ))}
      </div>
      <span className="legenda-nulo">
        <i /> sem dado ou fora do filtro
      </span>
    </div>
  );
}
