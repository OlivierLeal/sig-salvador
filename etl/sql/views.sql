SET search_path = atlas, public;

DROP MATERIALIZED VIEW IF EXISTS mv_kpi, mv_saneamento, mv_somas_setor;

CREATE MATERIALIZED VIEW mv_somas_setor AS
WITH pop AS (
    SELECT cd_setor,
           sum(p.pessoas)                       AS pop_total,
           sum(p.pessoas) FILTER (WHERE r.negra) AS pop_negra,
           sum(p.pessoas) FILTER (WHERE r.id = 1) AS pop_branca
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
), ida AS (
    SELECT cd_setor,
           sum(pessoas) AS pop_idade,
           sum(pessoas) FILTER (WHERE faixa IN ('60-69', '70+')) AS idosos,
           sum(pessoas) FILTER (WHERE faixa IN ('60-69', '70+') AND id_sexo = 2) AS idosas
    FROM fato_idade
    GROUP BY cd_setor
), obr AS (
    -- X = 1,5; par todo em sigilo fica de fora
    SELECT cd_setor, r.id AS id_raca, r.negra,
           CASE WHEN dom_com_obito IS NOT NULL OR dom_sem_obito IS NOT NULL THEN coalesce(dom_com_obito, 1.5) END AS com,
           CASE WHEN dom_com_obito IS NOT NULL OR dom_sem_obito IS NOT NULL
                THEN coalesce(dom_com_obito, 1.5) + coalesce(dom_sem_obito, 1.5) END AS base
    FROM fato_obito_resp o JOIN dim_raca r ON r.id = o.id_raca
), obs AS (
    SELECT cd_setor,
           sum(com) AS dom_obito, sum(base) AS dom_obito_base,
           sum(com) FILTER (WHERE negra) AS dom_obito_negro, sum(base) FILTER (WHERE negra) AS dom_obito_base_negro,
           sum(com) FILTER (WHERE id_raca = 1) AS dom_obito_branco, sum(base) FILTER (WHERE id_raca = 1) AS dom_obito_base_branco
    FROM obr
    GROUP BY cd_setor
)
SELECT s.cd_setor, s.cd_bairro, s.cd_fcu, s.em_favela,
       pop.pop_total, pop.pop_negra, pop.pop_branca,
       f.resp_mulheres, f.resp_homens + f.resp_mulheres AS resp_total,
       f.responsaveis, f.renda_media, f.renda_mediana,
       f.ndvi_medio, f.pct_vegetacao, f.ndvi_pixels,
       f.lst_media, f.pct_calor, f.lst_pixels,
       alf.analf_total, alf.base_total, alf.analf_mulher_negra, alf.base_mulher_negra,
       alf.analf_homem_branco, alf.base_homem_branco,
       esg.esgoto_adeq, esg.esgoto_tot, esg.esgoto_adeq_negro, esg.esgoto_tot_negro,
       esg.esgoto_adeq_branco, esg.esgoto_tot_branco,
       f.populacao AS pop_censo, f.mono_mulheres, f.mono_homens, f.dom_arranjo,
       coalesce(f.dom_improvisados, 0) + coalesce(f.dom_corticos, 0) + coalesce(f.dom_degradados, 0) AS dom_precarios,
       f.dom_permanentes + coalesce(f.dom_improvisados, 0) AS dom_base_precario,
       f.dom_6mais_moradores, f.dom_permanentes,
       -- X = 1,5; só setores com 100+ moradores e domicílio particular
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN coalesce(f.pop_quilombola, 1.5) END AS pop_quilombola,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN coalesce(f.obitos_homens, 1.5) + coalesce(f.obitos_mulheres, 1.5) END AS obitos,
       ida.pop_idade, ida.idosos, ida.idosas,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN obs.dom_obito END AS dom_obito,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN obs.dom_obito_base END AS dom_obito_base,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN obs.dom_obito_negro END AS dom_obito_negro,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN obs.dom_obito_base_negro END AS dom_obito_base_negro,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN obs.dom_obito_branco END AS dom_obito_branco,
       CASE WHEN f.populacao >= 100 AND f.domicilios_ocupados > 0 THEN obs.dom_obito_base_branco END AS dom_obito_base_branco
FROM dim_setor s
LEFT JOIN fato_setor f USING (cd_setor)
LEFT JOIN pop USING (cd_setor)
LEFT JOIN alf USING (cd_setor)
LEFT JOIN esg USING (cd_setor)
LEFT JOIN ida USING (cd_setor)
LEFT JOIN obs USING (cd_setor);

CREATE UNIQUE INDEX ON mv_somas_setor (cd_setor);

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
        sum(pct_vegetacao * ndvi_pixels) / nullif(sum(ndvi_pixels) FILTER (WHERE pct_vegetacao IS NOT NULL), 0) AS pct_vegetacao,
        sum(lst_media * lst_pixels) / nullif(sum(lst_pixels) FILTER (WHERE lst_media IS NOT NULL), 0) AS lst_media,
        sum(pct_calor * lst_pixels) / nullif(sum(lst_pixels) FILTER (WHERE pct_calor IS NOT NULL), 0) AS pct_calor,
        sum(lst_media * pop_total) / nullif(sum(pop_total) FILTER (WHERE lst_media IS NOT NULL), 0) AS lst_exposicao,
        sum(lst_media * pop_negra) / nullif(sum(pop_negra) FILTER (WHERE lst_media IS NOT NULL), 0) AS lst_exp_negra,
        sum(lst_media * pop_branca) / nullif(sum(pop_branca) FILTER (WHERE lst_media IS NOT NULL), 0) AS lst_exp_branca,
        100.0 * sum(idosos) / nullif(sum(pop_idade), 0) AS pct_idosos,
        100.0 * sum(idosas) / nullif(sum(idosos), 0) AS pct_fem_idosos,
        100.0 * sum(mono_mulheres) / nullif(sum(dom_arranjo), 0) AS pct_mono_feminina,
        100.0 * sum(mono_mulheres) / nullif(sum(mono_mulheres) + sum(mono_homens), 0) AS pct_mulher_entre_mono,
        100.0 * sum(dom_precarios) / nullif(sum(dom_base_precario), 0) AS pct_moradia_precaria,
        100.0 * sum(dom_6mais_moradores) / nullif(sum(dom_permanentes), 0) AS pct_dom_6mais,
        sum(pop_quilombola) AS pop_quilombola,
        100.0 * sum(pop_quilombola) / nullif(sum(pop_censo) FILTER (WHERE pop_quilombola IS NOT NULL), 0) AS pct_quilombola,
        1000.0 * sum(obitos) / (43 / 12.0) / nullif(sum(pop_censo) FILTER (WHERE obitos IS NOT NULL), 0) AS taxa_obito,
        100.0 * sum(dom_obito) / nullif(sum(dom_obito_base), 0) AS pct_dom_obito,
        100.0 * sum(dom_obito_negro) / nullif(sum(dom_obito_base_negro), 0) AS pct_dom_obito_negro,
        100.0 * sum(dom_obito_branco) / nullif(sum(dom_obito_base_branco), 0) AS pct_dom_obito_branco
    FROM mv_somas_setor
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
       round(pct_vegetacao, 2) AS pct_vegetacao,
       round(lst_media, 2) AS lst_media,
       round(pct_calor, 2) AS pct_calor,
       round(lst_exposicao, 2) AS lst_exposicao,
       round(lst_exp_negra - lst_exp_branca, 2) AS gap_calor,
       round(pct_idosos, 2) AS pct_idosos,
       round(pct_fem_idosos, 2) AS pct_fem_idosos,
       round(pct_mono_feminina, 2) AS pct_mono_feminina,
       round(pct_mulher_entre_mono, 2) AS pct_mulher_entre_mono,
       round(pct_moradia_precaria, 2) AS pct_moradia_precaria,
       round(pct_dom_6mais, 2) AS pct_dom_6mais,
       round(pop_quilombola) AS pop_quilombola,
       round(pct_quilombola, 2) AS pct_quilombola,
       round(taxa_obito, 2) AS taxa_obito,
       round(pct_dom_obito, 2) AS pct_dom_obito,
       round(pct_dom_obito_negro, 2) AS pct_dom_obito_negro,
       round(pct_dom_obito_branco, 2) AS pct_dom_obito_branco,
       round(pct_dom_obito_negro - pct_dom_obito_branco, 2) AS gap_obito_pp
FROM k;

CREATE UNIQUE INDEX ON mv_kpi (nivel, codigo);

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
