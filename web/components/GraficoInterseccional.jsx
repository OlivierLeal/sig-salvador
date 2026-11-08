"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatar } from "@/lib/metricas";

export default function GraficoInterseccional({ linhas }) {
  const racas = ["Branca", "Preta", "Parda"];
  const dados = racas.map((raca) => {
    const h = linhas.find((l) => l.raca === raca && l.sexo === "Masculino");
    const m = linhas.find((l) => l.raca === raca && l.sexo === "Feminino");
    return { raca, Homens: h?.taxa ?? null, Mulheres: m?.taxa ?? null, h, m };
  });
  const rotulo = (v) => (v === null || v === undefined ? "" : formatar(v, "%"));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ top: 20, right: 8, bottom: 0, left: -12 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--grade)" />
        <XAxis
          dataKey="raca"
          tickLine={false}
          axisLine={{ stroke: "var(--eixo)" }}
          tick={{ fill: "var(--texto-2)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--texto-3)", fontSize: 11 }}
          tickFormatter={(v) => `${v}%`}
          width={44}
        />
        <Tooltip
          cursor={{ fill: "var(--hover)" }}
          contentStyle={{ background: "var(--superficie)", border: "1px solid var(--linha)", borderRadius: 6 }}
          labelStyle={{ color: "var(--texto-1)", fontWeight: 600 }}
          formatter={(v, nome, item) => {
            const l = nome === "Homens" ? item.payload.h : item.payload.m;
            return [`${formatar(v, "%")} (${formatar(l?.pessoas ?? 0, "pessoas")} pessoas)`, nome];
          }}
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--texto-2)" }} />
        <Bar dataKey="Homens" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="Homens" position="top" formatter={rotulo} className="rotulo-barra" />
        </Bar>
        <Bar dataKey="Mulheres" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="Mulheres" position="top" formatter={rotulo} className="rotulo-barra" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
