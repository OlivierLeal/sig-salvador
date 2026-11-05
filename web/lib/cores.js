export const SEQUENCIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

export const DIVERGENTE = ["#184f95", "#3987e5", "#9ec5f4", "#f0efec", "#f2b0af", "#e34948", "#a52a29"];

export const SERIES = { a: "var(--series-1)", b: "var(--series-2)" };

export function classesQuantis(valores, cores = SEQUENCIAL) {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return { limites: [], cores: [cores[0]] };
  const n = cores.length;
  const limites = [];
  for (let i = 1; i < n; i++) {
    const q = v[Math.min(v.length - 1, Math.floor((i / n) * v.length))];
    if (limites.length === 0 || q > limites[limites.length - 1]) limites.push(q);
  }
  return { limites, cores: cores.slice(0, limites.length + 1) };
}

export function classesDivergentes(valores) {
  const v = valores.filter(Number.isFinite);
  const max = Math.max(1, ...v.map(Math.abs));
  const passo = max / 3.5;
  const limites = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((k) => +(k * passo).toFixed(2));
  return { limites, cores: DIVERGENTE };
}

export function corDe(valor, c) {
  if (valor === null) return null;
  let i = 0;
  while (i < c.limites.length && valor >= c.limites[i]) i++;
  return c.cores[i];
}
