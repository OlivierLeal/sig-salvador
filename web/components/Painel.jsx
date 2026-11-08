"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Contexto from "./Contexto";
import GraficoInterseccional from "./GraficoInterseccional";
import Icone from "./Icone";
import Kpis from "./Kpis";
import Legenda from "./Legenda";
import PontosSaneamento from "./PontosSaneamento";
import Ranking from "./Ranking";
import Secao from "./Secao";
import { SEQUENCIAL, classesDivergentes, classesQuantis } from "@/lib/cores";
import { carregarGeometria } from "@/lib/geometria";
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
  bairro: "",
  fcu: "",
  setor: "",
  sexo: 0,
  raca: 0,
  tema: "esgoto_rede",
};

const NIVEIS = { bairro: "Bairros", fcu: "Favelas", setor: "Setores" };
const FAVELA = { todos: "Cidade", sim: "Favelas", nao: "Fora delas" };

function lerUrl() {
  const sp = new URLSearchParams(window.location.search);
  const f = { ...INICIAL };
  for (const k of Object.keys(INICIAL)) {
    const v = sp.get(k);
    if (v === null) continue;
    f[k] = typeof INICIAL[k] === "number" ? Number(v) || 0 : v;
  }
  return f;
}

const query = (f) => new URLSearchParams(Object.entries(f).map(([k, v]) => [k, String(v)])).toString();

export default function Painel() {
  const [f, setF] = useState(INICIAL);
  const [unidades, setUnidades] = useState(new Map());
  const [lugares, setLugares] = useState([]);
  const [busca, setBusca] = useState("");
  const dialogo = useRef(null);

  useEffect(() => {
    setF(lerUrl());
    Promise.all([fetch("/api/bairros").then((r) => r.json()), carregarGeometria("fcu")])
      .then(([bairros, fcu]) =>
        setLugares([
          ...bairros.map((b) => ({ rotulo: `${b.nome} (bairro)`, tipo: "bairro", codigo: b.codigo })),
          ...fcu.features.map((x) => ({ rotulo: `${x.properties.nome} (favela)`, tipo: "fcu", codigo: x.properties.codigo })),
        ]),
      )
      .catch(() => setLugares([]));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(
      Object.entries(f)
        .filter(([k, v]) => v !== INICIAL[k])
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [f]);

  useEffect(() => {
    let vivo = true;
    carregarGeometria(f.nivel)
      .then((fc) => vivo && setUnidades(new Map(fc.features.map((x) => [x.properties.codigo, x.properties]))))
      .catch(() => vivo && setUnidades(new Map()));
    return () => {
      vivo = false;
    };
  }, [f.nivel]);

  const q = query(f);
  const mapa = useApi(`/api/mapa?${q}`);
  const resumo = useApi(`/api/resumo?${q}`);
  const inter = useApi(`/api/interseccional?${q}`);
  const san = useApi(`/api/saneamento?${q}`);

  const metrica = METRICA[f.metrica];
  const valores = useMemo(() => new Map((mapa.dados ?? []).map((r) => [r.codigo, r.valor])), [mapa.dados]);
  const classes = useMemo(() => {
    const v = (mapa.dados ?? []).map((r) => r.valor).filter((x) => x !== null);
    return metrica.divergente ? classesDivergentes(v) : classesQuantis(v, SEQUENCIAL);
  }, [mapa.dados, metrica.divergente]);

  const ranking = useMemo(
    () =>
      (mapa.dados ?? [])
        .filter((r) => r.valor !== null && unidades.has(r.codigo))
        .map((r) => ({ codigo: r.codigo, nome: unidades.get(r.codigo).nome, valor: r.valor })),
    [mapa.dados, unidades],
  );

  const set = (parcial) => setF((atual) => ({ ...atual, ...parcial }));
  const inicio = () => set({ bairro: "", fcu: "", setor: "", nivel: "bairro" });

  const selecionar = (u) => {
    if (f.nivel === "bairro") set({ bairro: u.codigo, fcu: "", setor: "", nivel: "setor" });
    else if (f.nivel === "fcu") set({ fcu: u.codigo, bairro: "", setor: "", nivel: "setor" });
    else set({ setor: f.setor === u.codigo ? "" : u.codigo });
  };

  const buscar = (texto) => {
    setBusca(texto);
    const l = lugares.find((x) => x.rotulo.toLowerCase() === texto.trim().toLowerCase());
    if (!l) return;
    set(
      l.tipo === "bairro"
        ? { bairro: l.codigo, fcu: "", setor: "", nivel: "setor" }
        : { fcu: l.codigo, bairro: "", setor: "", nivel: "setor" },
    );
    setBusca("");
  };

  const grupo =
    [f.sexo ? SEXOS[f.sexo] : "", f.raca ? RACAS[f.raca].split(" ")[0].toLowerCase() : ""].filter(Boolean).join(" ") || null;
  const nomes = resumo.dados?.nome ?? [];
  const territorio = f.favela === "todos" ? "" : f.favela === "sim" ? ", só favelas" : ", fora de favelas";
  const recorte = (nomes.length ? nomes[nomes.length - 1] : "Salvador") + territorio;
  const erro = mapa.erro || resumo.erro;
  const tituloMapa = `${metrica.rotulo}${metrica.usaTema ? `: ${TEMAS[f.tema].toLowerCase()}` : ""}${metrica.usaGrupo && grupo ? ` (${grupo})` : ""}`;

  return (
    <div className="app">
      <header className="barra">
        <a
          className="marca"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            inicio();
          }}
        >
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
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input
            id="busca"
            list="lugares"
            placeholder="Buscar bairro ou favela"
            value={busca}
            onChange={(e) => buscar(e.target.value)}
            aria-label="Buscar bairro ou favela"
          />
          <datalist id="lugares">
            {lugares.map((l) => (
              <option key={l.tipo + l.codigo} value={l.rotulo} />
            ))}
          </datalist>
        </label>
        <button type="button" className="barra-icone" onClick={inicio} title="Voltar para Salvador inteira" aria-label="Início">
          <Icone nome="casa" tamanho={20} />
        </button>
      </header>

      <aside className="lateral" aria-label="Menu de análise">
        <div className="lateral-rolagem">
          <Secao icone="indicador" titulo="Indicador">
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
          </Secao>

          <Secao icone="filtro" titulo="Filtros">
            <div className="campo">
              <span>Unidade do mapa</span>
              <div className="segmentado" role="radiogroup" aria-label="Unidade do mapa">
                {Object.keys(NIVEIS).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={f.nivel === n}
                    onClick={() => set({ nivel: n, setor: "" })}
                  >
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
          </Secao>

          <Secao icone="alvo" titulo="Recorte selecionado">
            <nav className="trilha" aria-label="Recorte atual">
              <button type="button" onClick={inicio} disabled={!f.bairro && !f.fcu && !f.setor}>
                Salvador
              </button>
              {nomes.map((n, i) => (
                <span key={n}>
                  <Icone nome="seta" tamanho={12} />
                  {i === nomes.length - 1 ? (
                    <strong>{n}</strong>
                  ) : (
                    <button type="button" onClick={() => set({ setor: "" })}>
                      {n}
                    </button>
                  )}
                </span>
              ))}
            </nav>
            <Kpis resumo={resumo.dados} ativa={f.metrica} tema={f.tema} grupo={grupo} onEscolher={(m) => set({ metrica: m })} />
          </Secao>

          <Secao icone="grafico" titulo="Análises">
            <h3>Analfabetismo por sexo e raça</h3>
            <p className="nota">Pessoas de 15 anos ou mais em {recorte}.</p>
            {inter.dados && <GraficoInterseccional linhas={inter.dados} />}

            <h3>Quem tem {TEMAS[f.tema].toLowerCase()}</h3>
            <p className="nota">Domicílios com acesso, pelo perfil de quem chefia.</p>
            <label className="campo">
              <span>Serviço</span>
              <select id="f-tema-grafico" value={f.tema} onChange={(e) => set({ tema: e.target.value })}>
                {Object.entries(TEMAS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {san.dados && <PontosSaneamento linhas={san.dados} />}

            <h3>
              {metrica.curto} por {NIVEIS[f.nivel].toLowerCase()}
            </h3>
            <Ranking
              itens={ranking}
              unidade={metrica.unidade}
              divergente={!!metrica.divergente}
              selecionado={f.nivel === "setor" ? f.setor : f.nivel === "bairro" ? f.bairro : f.fcu}
              onSelecionar={(c) => unidades.has(c) && selecionar(unidades.get(c))}
            />
          </Secao>

          <Secao icone="tabela" titulo="Tabelas do Censo" aberta={false}>
            <p className="nota">Salvador comparada com Bahia, Nordeste e Brasil nas tabelas municipais do Censo 2022.</p>
            <button type="button" className="botao" onClick={() => dialogo.current?.showModal()}>
              Abrir tabelas
            </button>
          </Secao>

          <p className="lateral-fonte">
            Fonte: IBGE, Censo Demográfico 2022. Células em sigilo estatístico aparecem como “sem dado”. Projeto de Big Data e
            Analytics, UCSal.
          </p>
        </div>
      </aside>

      <main className="area-mapa">
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <div className="titulo-mapa">
          <h1>{tituloMapa}</h1>
          <p>
            {recorte}.{" "}
            {f.nivel === "setor"
              ? "Clique num setor para ver a ficha."
              : `Clique em ${f.nivel === "bairro" ? "um bairro" : "uma favela"} para abrir os setores.`}
          </p>
        </div>
        <Mapa
          nivel={f.nivel}
          valores={valores}
          classes={classes}
          unidade={metrica.unidade}
          rotulo={metrica.rotulo}
          foco={{ bairro: f.bairro, fcu: f.fcu }}
          setor={f.setor}
          onSelecionar={selecionar}
          legenda={<Legenda classes={classes} unidade={metrica.unidade} titulo={metrica.curto} />}
        />
      </main>

      <dialog ref={dialogo} className="dialogo" aria-labelledby="dialogo-titulo">
        <div className="dialogo-topo">
          <h2 id="dialogo-titulo">Tabelas do Censo 2022</h2>
          <button type="button" className="barra-icone" onClick={() => dialogo.current?.close()} aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </div>
        <Contexto />
      </dialog>
    </div>
  );
}
