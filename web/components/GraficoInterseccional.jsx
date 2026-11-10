"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatar } from "@/lib/metricas";

export default function GraficoInterseccional({ linhas, medida = "taxa" }) {
  const racas = ["Branca", "Preta", "Parda"];
  const temp = medida === "temperatura";
  const comTemp = linhas.filter((l) => l.temperatura !== null);
  const pessoas = comTemp.reduce((a, l) => a + l.pessoas, 0);
  const media = pessoas ? comTemp.reduce((a, l) => a + l.pessoas * l.temperatura, 0) / pessoas : null;
  const valor = (l) => {
    if (!l) return null;
    if (!temp) return l.taxa;
    return l.temperatura === null || media === null ? null : l.temperatura - media;
  };
  const rotulo = (v) => {
    if (v === null || v === undefined) return "";
    if (!temp) return formatar(v, "%");
    return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  };

  const dados = racas.map((raca) => {
    const h = linhas.find((l) => l.raca === raca && l.sexo === "Masculino");
    const m = linhas.find((l) => l.raca === raca && l.sexo === "Feminino");
    return { raca, Homens: valor(h), Mulheres: valor(m), h, m };
  });

  return (
    <>
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
            tickFormatter={(v) => (temp ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : `${v}%`)}
            width={44}
          />
          {temp && <ReferenceLine y={0} stroke="var(--eixo)" />}
          <Tooltip
            cursor={{ fill: "var(--hover)" }}
            contentStyle={{ background: "var(--superficie)", border: "1px solid var(--linha)", borderRadius: 6 }}
            labelStyle={{ color: "var(--texto-1)", fontWeight: 600 }}
            formatter={(v, nome, item) => {
              const l = nome === "Homens" ? item.payload.h : item.payload.m;
              const n = `${formatar(l?.pessoas ?? 0, "pessoas")} pessoas`;
              if (!temp) return [`${formatar(v, "%")} (${n})`, nome];
              return [`${formatar(l?.temperatura, "°C")}, ${formatar(v, "Δ°C")} da média (${n})`, nome];
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
      {temp && media !== null && (
        <p className="nota">Valores em °C. Média do recorte para essas pessoas: {formatar(media, "°C")}.</p>
      )}
    </>
  );
}
