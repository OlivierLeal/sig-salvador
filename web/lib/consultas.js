import { consulta } from "./db";
import { METRICA } from "./metricas";

export function lerFiltros(sp) {
  const um = (v, ok, padrao) => (ok.includes(v) ? v : padrao);
  return {
    nivel: um(sp.get("nivel"), ["bairro", "fcu", "setor"], "bairro"),
    metrica: um(sp.get("metrica"), Object.keys(METRICA), "pct_negra"),
  };
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
};

const CHAVE = { setor: "s.cd_setor", bairro: "s.cd_bairro", fcu: "s.cd_fcu" };

const num = (v) => (v === null || v === undefined ? null : Number(v));

export async function valoresMapa(f) {
  const chave = CHAVE[f.nivel];
  const rows = await consulta(
    `SELECT ${chave} AS codigo, ${BASE[f.metrica]} AS valor
     FROM atlas.mv_somas_setor m JOIN atlas.dim_setor s USING (cd_setor)
     WHERE ${chave} IS NOT NULL GROUP BY ${chave}`,
  );
  return rows.map((r) => ({ codigo: r.codigo, valor: num(r.valor) }));
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
