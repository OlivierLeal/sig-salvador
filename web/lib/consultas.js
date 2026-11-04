import { consulta } from "./db";

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
