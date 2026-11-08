import { formatar } from "@/lib/metricas";

const NOMES = { Masculino: "Responsável homem", Feminino: "Responsável mulher" };

export default function PontosSaneamento({ linhas }) {
  const v = linhas.map((l) => l.pct).filter((x) => x !== null);
  if (!v.length) return <p className="vazio">Sem domicílios no recorte.</p>;
  const min = Math.max(0, Math.floor(Math.min(...v) / 5) * 5 - 5);
  const pos = (x) => ((x - min) / (100 - min)) * 100;
  const marcas = Array.from({ length: Math.floor((100 - min) / 5) + 1 }, (_, i) => min + i * 5).filter(
    (_, i, a) => a.length <= 6 || i % 2 === 0 || i === a.length - 1,
  );

  return (
    <div className="pontos">
      {["sexo", "raca"].map((dim) => (
        <div key={dim} className="pontos-bloco">
          <span className="pontos-dim">{dim === "sexo" ? "Por sexo do responsável" : "Por cor ou raça do responsável"}</span>
          {linhas
            .filter((l) => l.dimensao === dim)
            .map((l) => (
              <div key={l.grupo} className="pontos-linha" title={`${NOMES[l.grupo] ?? l.grupo}: ${formatar(l.pct, "%")}`}>
                <span className="pontos-rotulo">{NOMES[l.grupo] ?? l.grupo}</span>
                <span className="pontos-trilho">
                  {l.pct !== null && (
                    <i
                      className={`pontos-ponto ${l.grupo === "Negra" || l.grupo === "Feminino" ? "b" : "a"}`}
                      style={{ left: `${pos(l.pct)}%` }}
                    />
                  )}
                </span>
                <span className="pontos-valor">{formatar(l.pct, "%")}</span>
              </div>
            ))}
        </div>
      ))}
      <div className="pontos-eixo">
        <span className="pontos-rotulo" />
        <span className="pontos-trilho eixo">
          {marcas.map((m) => (
            <span key={m} style={{ left: `${pos(m)}%` }}>
              {m}%
            </span>
          ))}
        </span>
        <span className="pontos-valor" />
      </div>
    </div>
  );
}
