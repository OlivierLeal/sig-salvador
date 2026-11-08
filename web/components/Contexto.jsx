"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";

const TABELAS = {
  15: "Máquina de lavar e internet (mulheres, por raça)",
  13: "Meio de transporte para o trabalho (mulheres, por raça)",
  9: "Tempo de deslocamento para o trabalho, por sexo",
  8: "Local de trabalho, por sexo",
  16: "Saneamento das mulheres por território",
  11: "Chefes sem cônjuge e com filhos, por sexo",
  14: "Vivem com cônjuge, por sexo e deficiência",
  6: "Razão de sexos por cor ou raça",
  1: "Variação da população por cor ou raça (2010–2022)",
};
const RECORTES = ["Salvador", "Bahia", "Nordeste", "Brasil"];

function fmt(v, unidade) {
  if (v === null) return "–";
  const casas = unidade === "pessoas" ? 0 : 1;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });
}

export default function Contexto() {
  const [tabela, setTabela] = useState(15);
  const { dados, carregando, erro } = useApi(`/api/contexto?tabela=${tabela}`);

  const linhas = new Map();
  for (const l of dados ?? []) {
    const k = `${l.grupo}|${l.categoria}`;
    if (!linhas.has(k)) linhas.set(k, { grupo: l.grupo, categoria: l.categoria, unidade: l.unidade, v: {} });
    linhas.get(k).v[l.recorte] = l.valor;
  }
  const recortes = RECORTES.filter((r) => dados?.some((d) => d.recorte === r));

  return (
    <div className="contexto">
      <label className="campo">
        <span>Tabela do Censo 2022</span>
        <select id="contexto-tabela" value={tabela} onChange={(e) => setTabela(Number(e.target.value))}>
          {Object.entries(TABELAS).map(([n, nome]) => (
            <option key={n} value={n}>
              Tabela {n} · {nome}
            </option>
          ))}
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      {dados?.[0] && <p className="nota">{dados[0].titulo}</p>}
      <div className={`tabela-rolagem${carregando ? " carregando" : ""}`}>
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Categoria</th>
              {recortes.map((r) => (
                <th key={r} className="num">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...linhas.values()].map((l) => (
              <tr key={l.grupo + l.categoria}>
                <td>{l.grupo === l.categoria ? "" : l.grupo}</td>
                <td>{l.categoria}</td>
                {recortes.map((r) => (
                  <td key={r} className={`num${r === "Salvador" ? " destaque" : ""}`}>
                    {fmt(l.v[r] ?? null, l.unidade)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
