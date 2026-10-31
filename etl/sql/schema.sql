CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS atlas;
SET search_path = atlas, public;

DROP TABLE IF EXISTS fato_domicilio_resp, fato_alfabetizacao, fato_populacao, fato_setor,
    dim_setor, dim_fcu, dim_bairro, dim_raca, dim_sexo, ref_contexto, meta_fonte, meta_carga CASCADE;

CREATE TABLE dim_sexo (
    id   smallint PRIMARY KEY,
    nome text NOT NULL
);

CREATE TABLE dim_raca (
    id    smallint PRIMARY KEY,
    nome  text NOT NULL,
    negra boolean NOT NULL
);

CREATE TABLE dim_bairro (
    cd_bairro text PRIMARY KEY,
    nm_bairro text NOT NULL,
    geom      geometry(MultiPolygon, 4674) NOT NULL,
    geom_web  geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE dim_fcu (
    cd_fcu   text PRIMARY KEY,
    nm_fcu   text NOT NULL,
    area_km2 numeric(12, 6),
    geom     geometry(MultiPolygon, 4674) NOT NULL,
    geom_web geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE dim_setor (
    cd_setor       text PRIMARY KEY CHECK (length(cd_setor) = 15),
    cd_bairro      text REFERENCES dim_bairro,
    cd_subdistrito text,
    nm_subdistrito text,
    cd_fcu         text REFERENCES dim_fcu,
    situacao       text,
    cd_tipo        smallint,
    area_km2       numeric(12, 6),
    em_favela      boolean NOT NULL,
    geom           geometry(MultiPolygon, 4674) NOT NULL,
    geom_web       geometry(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE fato_setor (
    cd_setor            text PRIMARY KEY REFERENCES dim_setor,
    populacao           integer,
    homens              integer,
    mulheres            integer,
    domicilios_ocupados integer,
    media_moradores     numeric(5, 2),
    resp_homens         integer,
    resp_mulheres       integer,
    responsaveis        integer,
    renda_media         numeric(12, 2),
    renda_mediana       numeric(12, 2),
    ndvi_medio          numeric(6, 4),
    pct_vegetacao       numeric(5, 2),
    ndvi_pixels         integer
);

CREATE TABLE fato_populacao (
    cd_setor text     REFERENCES dim_setor,
    id_sexo  smallint REFERENCES dim_sexo,
    id_raca  smallint REFERENCES dim_raca,
    pessoas  integer,
    PRIMARY KEY (cd_setor, id_sexo, id_raca)
);

CREATE TABLE fato_alfabetizacao (
    cd_setor          text     REFERENCES dim_setor,
    id_sexo           smallint REFERENCES dim_sexo,
    id_raca           smallint REFERENCES dim_raca,
    alfabetizados     integer,
    nao_alfabetizados integer,
    PRIMARY KEY (cd_setor, id_sexo, id_raca)
);

CREATE TABLE fato_domicilio_resp (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cd_setor             text NOT NULL REFERENCES dim_setor,
    tema                 text NOT NULL CHECK (tema IN ('agua_rede', 'agua_encanada', 'banheiro', 'esgoto_rede', 'lixo_coletado')),
    id_sexo              smallint REFERENCES dim_sexo,
    id_raca              smallint REFERENCES dim_raca,
    domicilios_adequados integer,
    domicilios_total     integer,
    possui_sigilo        boolean NOT NULL,
    CHECK ((id_sexo IS NULL) <> (id_raca IS NULL))
);
CREATE UNIQUE INDEX ON fato_domicilio_resp (cd_setor, tema, coalesce(id_sexo, 0), coalesce(id_raca, 0));

CREATE TABLE ref_contexto (
    id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabela    smallint NOT NULL,
    titulo    text NOT NULL,
    recorte   text NOT NULL,
    grupo     text NOT NULL,
    categoria text NOT NULL,
    valor     numeric,
    unidade   text NOT NULL
);

CREATE TABLE meta_fonte (
    arquivo   text PRIMARY KEY,
    metadados jsonb NOT NULL
);

CREATE TABLE meta_carga (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    executado_em timestamptz NOT NULL DEFAULT now(),
    relatorio   jsonb NOT NULL
);
