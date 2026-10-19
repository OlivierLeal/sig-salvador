SET search_path = atlas, public;

CREATE INDEX ON dim_setor USING gist (geom);
CREATE INDEX ON dim_setor USING gist (geom_web);
CREATE INDEX ON dim_setor (cd_bairro);
CREATE INDEX ON dim_setor (cd_fcu);
CREATE INDEX ON dim_bairro USING gist (geom_web);
CREATE INDEX ON dim_fcu USING gist (geom_web);
CREATE INDEX ON fato_domicilio_resp (tema);
CREATE INDEX ON ref_contexto (tabela, recorte);

ANALYZE;
