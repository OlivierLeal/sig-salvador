"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import Legenda from "./Legenda";
import { SEQUENCIAL, classesDivergentes, classesQuantis } from "@/lib/cores";
import { METRICA, METRICAS, RACAS, SEXOS, TEMAS } from "@/lib/metricas";
import { useApi } from "@/lib/useApi";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="mapa mapa-carregando">Carregando mapa…</div>,
});

const INICIAL = {
  nivel: "bairro",
  metrica: "pct_negra",
  favela: "todos",
  sexo: 0,
  raca: 0,
  tema: "esgoto_rede",
};

const NIVEIS = { bairro: "Bairros", fcu: "Favelas", setor: "Setores" };
const FAVELA = { todos: "Cidade", sim: "Favelas", nao: "Fora delas" };

export default function Painel() {
  const [f, setF] = useState(INICIAL);
  const set = (parcial) => setF((atual) => ({ ...atual, ...parcial }));

  const mapa = useApi(`/api/mapa?${new URLSearchParams(f)}`);
  const metrica = METRICA[f.metrica];
  const valores = useMemo(() => new Map((mapa.dados ?? []).map((r) => [r.codigo, r.valor])), [mapa.dados]);
  const classes = useMemo(() => {
    const v = (mapa.dados ?? []).map((r) => r.valor).filter((x) => x !== null);
    return metrica.divergente ? classesDivergentes(v) : classesQuantis(v, SEQUENCIAL);
  }, [mapa.dados, metrica.divergente]);

  const grupo =
    [f.sexo ? SEXOS[f.sexo] : "", f.raca ? RACAS[f.raca].split(" ")[0].toLowerCase() : ""].filter(Boolean).join(" ") || null;
  const territorio = f.favela === "todos" ? "" : f.favela === "sim" ? ", só favelas" : ", fora de favelas";
  const tituloMapa = `${metrica.rotulo}${metrica.usaTema ? `: ${TEMAS[f.tema].toLowerCase()}` : ""}${metrica.usaGrupo && grupo ? ` (${grupo})` : ""}`;

  return (
    <div className="app">
      <header className="barra">
        <a className="marca" href="/">
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
            <path d="M8 31 L15 10 L21 22 L25 15 L32 31 Z" fill="#14285a" />
            <path d="M15 10 L21 22 L18 31 L8 31 Z" fill="#2a78d6" />
            <circle cx="28" cy="10" r="3.2" fill="#eb6834" />
          </svg>
          <span>
            <strong>Atlas Salvador</strong>
            <small>Desigualdade no território</small>
          </span>
        </a>
      </header>

      <aside className="lateral" aria-label="Menu de análise">
        <div className="lateral-rolagem">
          <div className="lateral-conteudo">
            <label className="campo">
              <span>O que mostrar no mapa</span>
              <select id="f-metrica" value={f.metrica} onChange={(e) => set({ metrica: e.target.value })}>
                {METRICAS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </label>
            {metrica.usaTema && (
              <label className="campo">
                <span>Serviço</span>
                <select id="f-tema" value={f.tema} onChange={(e) => set({ tema: e.target.value })}>
                  {Object.entries(TEMAS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="nota">{metrica.descricao}</p>
            <div className="campo">
              <span>Unidade do mapa</span>
              <div className="segmentado" role="radiogroup" aria-label="Unidade do mapa">
                {Object.keys(NIVEIS).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={f.nivel === n} onClick={() => set({ nivel: n })}>
                    {NIVEIS[n]}
                  </button>
                ))}
              </div>
            </div>
            <div className="campo">
              <span>Território</span>
              <div className="segmentado" role="radiogroup" aria-label="Território">
                {Object.keys(FAVELA).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={f.favela === k} onClick={() => set({ favela: k })}>
                    {FAVELA[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className="campos-par">
              <label className="campo">
                <span>Sexo</span>
                <select id="f-sexo" value={f.sexo} onChange={(e) => set({ sexo: Number(e.target.value) })}>
                  {Object.entries(SEXOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span>Cor ou raça</span>
                <select id="f-raca" value={f.raca} onChange={(e) => set({ raca: Number(e.target.value) })}>
                  {[0, 6, 1, 2, 4, 3, 5].map((k) => (
                    <option key={k} value={k}>
                      {RACAS[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {metrica.id === "saneamento" && f.sexo !== 0 && f.raca !== 0 && (
              <p className="nota aviso">
                O IBGE não cruza sexo e raça no saneamento. Com os dois filtros, vale a raça do responsável.
              </p>
            )}
            <button type="button" className="botao-texto" onClick={() => setF(INICIAL)}>
              Limpar filtros
            </button>
          </div>
          <p className="lateral-fonte">
            Fonte: IBGE, Censo Demográfico 2022. Células em sigilo estatístico aparecem como “sem dado”. Projeto de Big Data e
            Analytics, UCSal.
          </p>
        </div>
      </aside>

      <main className="area-mapa">
        {mapa.erro && (
          <p className="erro" role="alert">
            {mapa.erro}
          </p>
        )}
        <div className="titulo-mapa">
          <h1>{tituloMapa}</h1>
          <p>
            Salvador{territorio}, por {NIVEIS[f.nivel].toLowerCase()}.
          </p>
        </div>
        <Mapa
          nivel={f.nivel}
          valores={valores}
          classes={classes}
          unidade={metrica.unidade}
          rotulo={metrica.rotulo}
          legenda={<Legenda classes={classes} unidade={metrica.unidade} titulo={metrica.curto} />}
        />
      </main>
    </div>
  );
}
