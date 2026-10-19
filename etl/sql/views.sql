SET search_path = atlas, public;

DROP MATERIALIZED VIEW IF EXISTS mv_kpi, mv_saneamento;
DROP VIEW IF EXISTS vw_somas_setor;

-- numeradores e denominadores por setor; os KPIs de qualquer recorte saem da razão das somas
CREATE VIEW vw_somas_setor AS
WITH pop AS (
    SELECT cd_setor,
           sum(p.pessoas)                       AS pop_total,
           sum(p.pessoas) FILTER (WHERE r.negra) AS pop_negra
    FROM fato_populacao p JOIN dim_raca r ON r.id = p.id_raca
    GROUP BY cd_setor
), alf AS (
    SELECT cd_setor,
           sum(nao_alfabetizados) AS analf_total,
           sum(coalesce(alfabetizados, 0) + coalesce(nao_alfabetizados, 0)) AS base_total,
           sum(nao_alfabetizados) FILTER (WHERE id_sexo = 2 AND r.negra) AS analf_mulher_negra,
           sum(coalesce(alfabetizados, 0) + coalesce(nao_alfabetizados, 0)) FILTER (WHERE id_sexo = 2 AND r.negra) AS base_mulher_negra,
           sum(nao_alfabetizados) FILTER (WHERE id_sexo = 1 AND id_raca = 1) AS analf_homem_branco,
           sum(coalesce(alfabetizados, 0) + coalesce(nao_alfabetizados, 0)) FILTER (WHERE id_sexo = 1 AND id_raca = 1) AS base_homem_branco
    FROM fato_alfabetizacao a JOIN dim_raca r ON r.id = a.id_raca
    GROUP BY cd_setor
), esg AS (
    SELECT cd_setor,
           sum(domicilios_adequados) FILTER (WHERE id_sexo IS NOT NULL) AS esgoto_adeq,
           sum(domicilios_total)     FILTER (WHERE id_sexo IS NOT NULL) AS esgoto_tot,
           sum(domicilios_adequados) FILTER (WHERE r.negra)    AS esgoto_adeq_negro,
           sum(domicilios_total)     FILTER (WHERE r.negra)    AS esgoto_tot_negro,
           sum(domicilios_adequados) FILTER (WHERE r.id = 1)   AS esgoto_adeq_branco,
           sum(domicilios_total)     FILTER (WHERE r.id = 1)   AS esgoto_tot_branco
    FROM fato_domicilio_resp d LEFT JOIN dim_raca r ON r.id = d.id_raca
    WHERE tema = 'esgoto_rede'
    GROUP BY cd_setor
)
SELECT s.cd_setor, s.cd_bairro, s.cd_fcu, s.em_favela,
       pop.pop_total, pop.pop_negra,
       f.resp_mulheres, f.resp_homens + f.resp_mulheres AS resp_total,
       f.responsaveis, f.renda_media, f.renda_mediana,
       f.ndvi_medio, f.pct_vegetacao, f.ndvi_pixels,
       alf.analf_total, alf.base_total, alf.analf_mulher_negra, alf.base_mulher_negra,
       alf.analf_homem_branco, alf.base_homem_branco,
       esg.esgoto_adeq, esg.esgoto_tot, esg.esgoto_adeq_negro, esg.esgoto_tot_negro,
       esg.esgoto_adeq_branco, esg.esgoto_tot_branco
FROM dim_setor s
LEFT JOIN fato_setor f USING (cd_setor)
LEFT JOIN pop USING (cd_setor)
LEFT JOIN alf USING (cd_setor)
LEFT JOIN esg USING (cd_setor);

CREATE MATERIALIZED VIEW mv_kpi AS
WITH k AS (
    SELECT
        CASE WHEN grouping(cd_setor) = 0 THEN 'setor'
             WHEN grouping(cd_bairro) = 0 THEN 'bairro'
             WHEN grouping(cd_fcu) = 0 THEN 'fcu'
             WHEN grouping(em_favela) = 0 THEN 'favela'
             ELSE 'cidade' END AS nivel,
        coalesce(cd_setor, cd_bairro, cd_fcu,
                 CASE em_favela WHEN true THEN 'favela' WHEN false THEN 'nao_favela' END,
                 'salvador') AS codigo,
        count(*) AS setores,
        sum(pop_total) AS populacao,
        sum(pop_negra) AS pop_negra,
        100.0 * sum(pop_negra) / nullif(sum(pop_total), 0) AS pct_negra,
        100.0 * sum(resp_mulheres) / nullif(sum(resp_total), 0) AS pct_resp_mulher,
        sum(renda_media * responsaveis) / nullif(sum(responsaveis) FILTER (WHERE renda_media IS NOT NULL), 0) AS renda_media,
        sum(renda_mediana * responsaveis) / nullif(sum(responsaveis) FILTER (WHERE renda_mediana IS NOT NULL), 0) AS renda_mediana,
        100.0 * sum(analf_total) / nullif(sum(base_total), 0) AS taxa_analf,
        100.0 * sum(analf_mulher_negra) / nullif(sum(base_mulher_negra), 0) AS taxa_analf_mulher_negra,
        100.0 * sum(analf_homem_branco) / nullif(sum(base_homem_branco), 0) AS taxa_analf_homem_branco,
        100.0 * sum(esgoto_adeq) / nullif(sum(esgoto_tot), 0) AS pct_esgoto,
        100.0 * sum(esgoto_adeq_negro) / nullif(sum(esgoto_tot_negro), 0) AS pct_esgoto_resp_negro,
        100.0 * sum(esgoto_adeq_branco) / nullif(sum(esgoto_tot_branco), 0) AS pct_esgoto_resp_branco,
        sum(ndvi_medio * ndvi_pixels) / nullif(sum(ndvi_pixels) FILTER (WHERE ndvi_medio IS NOT NULL), 0) AS ndvi_medio,
        sum(pct_vegetacao * ndvi_pixels) / nullif(sum(ndvi_pixels) FILTER (WHERE pct_vegetacao IS NOT NULL), 0) AS pct_vegetacao
    FROM vw_somas_setor
    GROUP BY GROUPING SETS ((cd_setor), (cd_bairro), (cd_fcu), (em_favela), ())
    HAVING NOT (grouping(cd_bairro) = 0 AND cd_bairro IS NULL)
       AND NOT (grouping(cd_fcu) = 0 AND cd_fcu IS NULL)
)
SELECT nivel, codigo, setores, populacao, pop_negra,
       round(pct_negra, 2) AS pct_negra,
       round(pct_resp_mulher, 2) AS pct_resp_mulher,
       round(renda_media, 2) AS renda_media,
       round(renda_mediana, 2) AS renda_mediana,
       round(taxa_analf, 2) AS taxa_analf,
       round(taxa_analf_mulher_negra, 2) AS taxa_analf_mulher_negra,
       round(taxa_analf_homem_branco, 2) AS taxa_analf_homem_branco,
       round(taxa_analf_mulher_negra - taxa_analf_homem_branco, 2) AS gap_analf_pp,
       round(pct_esgoto, 2) AS pct_esgoto,
       round(pct_esgoto_resp_negro, 2) AS pct_esgoto_resp_negro,
       round(pct_esgoto_resp_branco, 2) AS pct_esgoto_resp_branco,
       round(pct_esgoto_resp_branco - pct_esgoto_resp_negro, 2) AS gap_esgoto_pp,
       round(ndvi_medio, 4) AS ndvi_medio,
       round(pct_vegetacao, 2) AS pct_vegetacao
FROM k;

CREATE UNIQUE INDEX ON mv_kpi (nivel, codigo);

-- todos os temas de saneamento, por sexo e por raça do responsável (inclui o grupo "Negra" = preta + parda)
CREATE MATERIALIZED VIEW mv_saneamento AS
WITH base AS (
    SELECT d.tema, s.cd_setor, s.cd_bairro, s.cd_fcu, s.em_favela,
           CASE WHEN d.id_sexo IS NOT NULL THEN 'sexo' ELSE 'raca' END AS dimensao,
           coalesce(sx.nome, r.nome) AS grupo,
           d.domicilios_adequados, d.domicilios_total
    FROM fato_domicilio_resp d
    JOIN dim_setor s USING (cd_setor)
    LEFT JOIN dim_sexo sx ON sx.id = d.id_sexo
    LEFT JOIN dim_raca r ON r.id = d.id_raca
    UNION ALL
    SELECT d.tema, s.cd_setor, s.cd_bairro, s.cd_fcu, s.em_favela, 'raca', 'Negra',
           d.domicilios_adequados, d.domicilios_total
    FROM fato_domicilio_resp d
    JOIN dim_setor s USING (cd_setor)
    JOIN dim_raca r ON r.id = d.id_raca AND r.negra
)
SELECT
    CASE WHEN grouping(cd_setor) = 0 THEN 'setor'
         WHEN grouping(cd_bairro) = 0 THEN 'bairro'
         WHEN grouping(cd_fcu) = 0 THEN 'fcu'
         WHEN grouping(em_favela) = 0 THEN 'favela'
         ELSE 'cidade' END AS nivel,
    coalesce(cd_setor, cd_bairro, cd_fcu,
             CASE em_favela WHEN true THEN 'favela' WHEN false THEN 'nao_favela' END,
             'salvador') AS codigo,
    tema, dimensao, grupo,
    sum(domicilios_adequados) AS domicilios_adequados,
    sum(domicilios_total) AS domicilios_total,
    round(100.0 * sum(domicilios_adequados) / nullif(sum(domicilios_total), 0), 2) AS pct_adequado
FROM base
GROUP BY tema, dimensao, grupo, GROUPING SETS ((cd_setor), (cd_bairro), (cd_fcu), (em_favela), ())
HAVING NOT (grouping(cd_bairro) = 0 AND cd_bairro IS NULL)
   AND NOT (grouping(cd_fcu) = 0 AND cd_fcu IS NULL);

CREATE INDEX ON mv_saneamento (nivel, codigo, tema);
