"use client";

import { useState } from "react";
import { formatar } from "@/lib/metricas";

export default function Ranking({ itens, unidade, divergente, selecionado, onSelecionar }) {
  const [modo, setModo] = useState("maiores");
  const ordenado = [...itens].sort((a, b) => b.valor - a.valor);
  const lista = modo === "maiores" ? ordenado.slice(0, 10) : modo === "menores" ? ordenado.slice(-10).reverse() : ordenado;
  const max = Math.max(...itens.map((i) => Math.abs(i.valor)), 0) || 1;

  return (
    <div className="ranking">
      <div className="segmentado pequeno" role="tablist" aria-label="Ordenação">
        {["maiores", "menores", "todos"].map((m) => (
          <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)}>
            {m === "maiores" ? "10 maiores" : m === "menores" ? "10 menores" : `Tabela (${itens.length})`}
          </button>
        ))}
      </div>
      <ol className={`ranking-lista${modo === "todos" ? " rolagem" : ""}`}>
        {lista.map((i) => {
          const largura = (Math.abs(i.valor) / max) * (divergente ? 50 : 100);
          const estilo = divergente
            ? { width: `${largura}%`, left: i.valor < 0 ? `${50 - largura}%` : "50%" }
            : { width: `${largura}%`, left: 0 };
          return (
            <li key={i.codigo}>
              <button type="button" className={i.codigo === selecionado ? "ativo" : ""} onClick={() => onSelecionar(i.codigo)}>
                <span className="ranking-nome">{i.nome}</span>
                <span className="ranking-trilho">
                  {divergente && <span className="ranking-zero" />}
                  <span className={`ranking-barra${divergente && i.valor > 0 ? " pos" : ""}`} style={estilo} />
                </span>
                <span className="ranking-valor">{formatar(i.valor, unidade)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
