"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="mapa mapa-carregando">Carregando mapa…</div>,
});

const NIVEIS = { bairro: "Bairros", fcu: "Favelas", setor: "Setores" };

export default function Painel() {
  const [nivel, setNivel] = useState("bairro");

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
            <div className="campo">
              <span>Unidade do mapa</span>
              <div className="segmentado" role="radiogroup" aria-label="Unidade do mapa">
                {Object.keys(NIVEIS).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={nivel === n} onClick={() => setNivel(n)}>
                    {NIVEIS[n]}
                  </button>
                ))}
              </div>
            </div>
            <p className="nota">Contorno tracejado: Favelas e Comunidades Urbanas (IBGE, 2022).</p>
          </div>
          <p className="lateral-fonte">Fonte: IBGE, Censo Demográfico 2022. Projeto de Big Data e Analytics, UCSal.</p>
        </div>
      </aside>

      <main className="area-mapa">
        <div className="titulo-mapa">
          <h1>{NIVEIS[nivel]} de Salvador</h1>
        </div>
        <Mapa nivel={nivel} />
      </main>
    </div>
  );
}
