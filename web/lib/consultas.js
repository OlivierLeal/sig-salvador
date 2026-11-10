import { consulta } from "./db";
import { METRICA, TEMAS } from "./metricas";

const CODIGO = /^\d{1,15}$/;

export function lerFiltros(sp) {
  const um = (v, ok, padrao) => (ok.includes(v) ? v : padrao);
  const codigo = (v) => (v && CODIGO.test(v) ? v : "");
  const inteiro = (v, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
  };
  return {
    nivel: um(sp.get("nivel"), ["bairro", "fcu", "setor"], "bairro"),
    metrica: um(sp.get("metrica"), Object.keys(METRICA), "pct_negra"),
    favela: um(sp.get("favela"), ["todos", "sim", "nao"], "todos"),
    bairro: codigo(sp.get("bairro")),
    fcu: codigo(sp.get("fcu")),
    setor: codigo(sp.get("setor")),
    sexo: inteiro(sp.get("sexo"), 2),
    raca: inteiro(sp.get("raca"), 6),
    tema: um(sp.get("tema"), Object.keys(TEMAS), "esgoto_rede"),
  };
}

class Params {
  valores = [];
  add(v) {
    this.valores.push(v);
    return `$${this.valores.length}`;
  }
}

function territorio(f, p, incluirSetor) {
  const cond = ["true"];
  if (f.favela !== "todos") cond.push(`s.em_favela = ${p.add(f.favela === "sim")}`);
  if (f.bairro) cond.push(`s.cd_bairro = ${p.add(f.bairro)}`);
  if (f.fcu) cond.push(`s.cd_fcu = ${p.add(f.fcu)}`);
  if (incluirSetor && f.setor) cond.push(`s.cd_setor = ${p.add(f.setor)}`);
  return cond.join(" AND ");
}

function racas(f) {
  if (f.raca === 0) return null;
  return f.raca === 6 ? [2, 4] : [f.raca];
}

function grupoPessoas(f, p, alias) {
  const cond = [];
  if (f.sexo) cond.push(`${alias}.id_sexo = ${p.add(f.sexo)}`);
  const r = racas(f);
  if (r) cond.push(`${alias}.id_raca = ANY(${p.add(r)}::smallint[])`);
  return cond.length ? cond.join(" AND ") : "true";
}

function grupoSaneamento(f, p) {
  const r = racas(f);
  if (r) return `d.id_raca = ANY(${p.add(r)}::smallint[])`;
  if (f.sexo) return `d.id_sexo = ${p.add(f.sexo)}`;
  return "d.id_sexo IS NOT NULL";
}

const BASE = {
  populacao: "sum(m.pop_total)",
  pct_negra: "100.0 * sum(m.pop_negra) / nullif(sum(m.pop_total), 0)",
  pct_resp_mulher: "100.0 * sum(m.resp_mulheres) / nullif(sum(m.resp_total), 0)",
  renda_mediana:
    "sum(m.renda_mediana * m.responsaveis) / nullif(sum(m.responsaveis) FILTER (WHERE m.renda_mediana IS NOT NULL), 0)",
  taxa_analf: "100.0 * sum(m.analf_total) / nullif(sum(m.base_total), 0)",
  gap_analf_pp:
    "100.0 * sum(m.analf_mulher_negra) / nullif(sum(m.base_mulher_negra), 0)" +
    " - 100.0 * sum(m.analf_homem_branco) / nullif(sum(m.base_homem_branco), 0)",
  gap_esgoto_pp:
    "100.0 * sum(m.esgoto_adeq_branco) / nullif(sum(m.esgoto_tot_branco), 0)" +
    " - 100.0 * sum(m.esgoto_adeq_negro) / nullif(sum(m.esgoto_tot_negro), 0)",
  ndvi_medio: "sum(m.ndvi_medio * m.ndvi_pixels) / nullif(sum(m.ndvi_pixels) FILTER (WHERE m.ndvi_medio IS NOT NULL), 0)",
  pct_vegetacao:
    "sum(m.pct_vegetacao * m.ndvi_pixels) / nullif(sum(m.ndvi_pixels) FILTER (WHERE m.pct_vegetacao IS NOT NULL), 0)",
  lst_media: "sum(m.lst_media * m.lst_pixels) / nullif(sum(m.lst_pixels) FILTER (WHERE m.lst_media IS NOT NULL), 0)",
  pct_calor: "sum(m.pct_calor * m.lst_pixels) / nullif(sum(m.lst_pixels) FILTER (WHERE m.pct_calor IS NOT NULL), 0)",
  gap_calor:
    "sum(m.lst_media * m.pop_negra) / nullif(sum(m.pop_negra) FILTER (WHERE m.lst_media IS NOT NULL), 0)" +
    " - sum(m.lst_media * m.pop_branca) / nullif(sum(m.pop_branca) FILTER (WHERE m.lst_media IS NOT NULL), 0)",
};

const CHAVE = { setor: "s.cd_setor", bairro: "s.cd_bairro", fcu: "s.cd_fcu" };

function sqlMetrica(f, p, chave, incluirSetor, metrica = f.metrica) {
  const where = territorio(f, p, incluirSetor);
  const sel = chave ? `${chave} AS codigo,` : "";
  const grp = chave ? `AND ${chave} IS NOT NULL GROUP BY ${chave}` : "";
  const temGrupo = f.sexo !== 0 || f.raca !== 0;

  if (metrica === "pct_grupo" || (metrica === "taxa_analf" && temGrupo)) {
    const g = grupoPessoas(f, p, "x");
    const expr =
      metrica === "pct_grupo"
        ? `100.0 * sum(x.pessoas) FILTER (WHERE ${g}) / nullif(sum(x.pessoas), 0)`
        : `100.0 * sum(x.nao_alfabetizados) FILTER (WHERE ${g})` +
          ` / nullif(sum(coalesce(x.alfabetizados, 0) + coalesce(x.nao_alfabetizados, 0)) FILTER (WHERE ${g}), 0)`;
    const tabela = metrica === "pct_grupo" ? "fato_populacao" : "fato_alfabetizacao";
    return `SELECT ${sel} ${expr} AS valor FROM atlas.${tabela} x JOIN atlas.dim_setor s USING (cd_setor)
            WHERE ${where} ${grp}`;
  }
  if (metrica === "lst_exposicao") {
    const g = grupoPessoas(f, p, "x");
    return `SELECT ${sel} sum(x.pessoas * fs.lst_media) FILTER (WHERE ${g} AND fs.lst_media IS NOT NULL)
              / nullif(sum(x.pessoas) FILTER (WHERE ${g} AND fs.lst_media IS NOT NULL), 0) AS valor
            FROM atlas.fato_populacao x JOIN atlas.fato_setor fs USING (cd_setor) JOIN atlas.dim_setor s USING (cd_setor)
            WHERE ${where} ${grp}`;
  }
  if (metrica === "saneamento") {
    const g = grupoSaneamento(f, p);
    return `SELECT ${sel} 100.0 * sum(d.domicilios_adequados) / nullif(sum(d.domicilios_total), 0) AS valor
            FROM atlas.fato_domicilio_resp d JOIN atlas.dim_setor s USING (cd_setor)
            WHERE d.tema = ${p.add(f.tema)} AND ${g} AND ${where} ${grp}`;
  }
  return `SELECT ${sel} ${BASE[metrica]} AS valor FROM atlas.mv_somas_setor m JOIN atlas.dim_setor s USING (cd_setor)
          WHERE ${where} ${grp}`;
}

const num = (v) => (v === null || v === undefined ? null : Number(v));

export async function valoresMapa(f) {
  const p = new Params();
  const rows = await consulta(sqlMetrica(f, p, CHAVE[f.nivel], false), p.valores);
  return rows.map((r) => ({ codigo: r.codigo, valor: num(r.valor) }));
}

const RESUMO = [
  "populacao",
  "pct_negra",
  "pct_resp_mulher",
  "renda_mediana",
  "taxa_analf",
  "gap_analf_pp",
  "saneamento",
  "gap_esgoto_pp",
  "ndvi_medio",
  "pct_vegetacao",
  "lst_media",
  "pct_calor",
  "lst_exposicao",
  "gap_calor",
  "pct_grupo",
];

async function kpis(f, incluirSetor) {
  const valores = await Promise.all(
    RESUMO.map(async (m) => {
      const p = new Params();
      const [r] = await consulta(sqlMetrica(f, p, null, incluirSetor, m), p.valores);
      return [m, num(r?.valor)];
    }),
  );
  return Object.fromEntries(valores);
}

export async function resumo(f) {
  const limpo = { ...f, bairro: "", fcu: "", setor: "" };
  const [selecao, cidade, favela, naoFavela] = await Promise.all([
    kpis(f, true),
    kpis({ ...limpo, favela: "todos" }, false),
    kpis({ ...limpo, favela: "sim" }, false),
    kpis({ ...limpo, favela: "nao" }, false),
  ]);
  return { selecao, cidade, favela, naoFavela, nome: await nomeSelecao(f) };
}

async function nomeSelecao(f) {
  const partes = [];
  if (f.bairro) {
    const [r] = await consulta("SELECT nm_bairro FROM atlas.dim_bairro WHERE cd_bairro = $1", [f.bairro]);
    if (r) partes.push(r.nm_bairro);
  }
  if (f.fcu) {
    const [r] = await consulta("SELECT nm_fcu FROM atlas.dim_fcu WHERE cd_fcu = $1", [f.fcu]);
    if (r) partes.push(r.nm_fcu);
  }
  if (f.setor) partes.push(`Setor ${f.setor}`);
  return partes;
}

export async function interseccional(f) {
  const p = new Params();
  const where = territorio(f, p, true);
  const rows = await consulta(
    `SELECT sx.nome AS sexo, r.nome AS raca, sum(pp.pessoas) AS pessoas,
            100.0 * sum(a.nao_alfabetizados)
              / nullif(sum(coalesce(a.alfabetizados, 0) + coalesce(a.nao_alfabetizados, 0)), 0) AS taxa,
            sum(pp.pessoas * fs.lst_media) FILTER (WHERE fs.lst_media IS NOT NULL)
              / nullif(sum(pp.pessoas) FILTER (WHERE fs.lst_media IS NOT NULL), 0) AS temperatura
     FROM atlas.fato_populacao pp
     JOIN atlas.fato_alfabetizacao a USING (cd_setor, id_sexo, id_raca)
     JOIN atlas.fato_setor fs USING (cd_setor)
     JOIN atlas.dim_setor s USING (cd_setor)
     JOIN atlas.dim_sexo sx ON sx.id = pp.id_sexo
     JOIN atlas.dim_raca r ON r.id = pp.id_raca
     WHERE ${where} AND r.id IN (1, 2, 4)
     GROUP BY sx.id, sx.nome, r.id, r.nome ORDER BY r.id, sx.id`,
    p.valores,
  );
  return rows.map((r) => ({
    sexo: r.sexo,
    raca: r.raca,
    pessoas: Number(r.pessoas),
    taxa: num(r.taxa),
    temperatura: num(r.temperatura),
  }));
}

export async function saneamentoPorGrupo(f) {
  const p = new Params();
  const where = territorio(f, p, true);
  const rows = await consulta(
    `WITH base AS (
       SELECT CASE WHEN d.id_sexo IS NOT NULL THEN 'sexo' ELSE 'raca' END AS dimensao,
              coalesce(sx.nome, r.nome) AS grupo, d.domicilios_adequados, d.domicilios_total, r.negra
       FROM atlas.fato_domicilio_resp d
       JOIN atlas.dim_setor s USING (cd_setor)
       LEFT JOIN atlas.dim_sexo sx ON sx.id = d.id_sexo
       LEFT JOIN atlas.dim_raca r ON r.id = d.id_raca
       WHERE d.tema = ${p.add(f.tema)} AND ${where} AND (r.id IS NULL OR r.id IN (1, 2, 4))
     )
     SELECT dimensao, grupo, 100.0 * sum(domicilios_adequados) / nullif(sum(domicilios_total), 0) AS pct
     FROM base GROUP BY dimensao, grupo
     UNION ALL
     SELECT 'raca', 'Negra', 100.0 * sum(domicilios_adequados) / nullif(sum(domicilios_total), 0)
     FROM base WHERE negra`,
    p.valores,
  );
  const ordem = ["Masculino", "Feminino", "Branca", "Negra", "Preta", "Parda"];
  return rows
    .map((r) => ({ grupo: r.grupo, dimensao: r.dimensao, pct: num(r.pct) }))
    .sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo));
}

export async function contexto(tabela) {
  return consulta(
    `SELECT recorte, grupo, categoria, valor::float AS valor, unidade, titulo
     FROM atlas.ref_contexto WHERE tabela = $1 ORDER BY id`,
    [tabela],
  );
}

export async function bairros() {
  return consulta("SELECT cd_bairro AS codigo, nm_bairro AS nome FROM atlas.dim_bairro ORDER BY nm_bairro");
}

export async function geometria(nivel) {
  const sql = {
    setor: `SELECT s.cd_setor AS codigo, coalesce(b.nm_bairro, '') || ' · setor ' || right(s.cd_setor, 4) AS nome,
                   s.em_favela, s.cd_bairro, s.cd_fcu, ST_AsGeoJSON(s.geom_web, 5)::json AS g
            FROM atlas.dim_setor s LEFT JOIN atlas.dim_bairro b USING (cd_bairro)`,
    bairro: `SELECT cd_bairro AS codigo, nm_bairro AS nome, false AS em_favela, cd_bairro, null AS cd_fcu,
                    ST_AsGeoJSON(geom_web, 5)::json AS g FROM atlas.dim_bairro`,
    fcu: `SELECT cd_fcu AS codigo, nm_fcu AS nome, true AS em_favela, null AS cd_bairro, cd_fcu,
                 ST_AsGeoJSON(geom_web, 5)::json AS g FROM atlas.dim_fcu`,
  }[nivel];
  const rows = await consulta(sql);
  return {
    type: "FeatureCollection",
    features: rows.map(({ g, ...props }) => ({ type: "Feature", properties: props, geometry: g })),
  };
}
