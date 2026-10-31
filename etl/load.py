import io
import json
import os

import geopandas as gpd
import pandas as pd
import psycopg2
import shapely
from psycopg2 import sql

from config import PROCESSED, RACAS, RACAS_NEGRAS, SEXOS, SQL_DIR

ORDEM = ["dim_bairro", "dim_fcu", "dim_setor", "fato_setor", "fato_populacao", "fato_alfabetizacao",
         "fato_domicilio_resp", "ref_contexto"]
GEOMETRIAS = {"geom": 4674, "geom_web": 4326}


def conectar():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("defina DATABASE_URL no .env")
    return psycopg2.connect(url)


def _ler(nome):
    path = PROCESSED / f"{nome}.parquet"
    if nome.startswith("dim_") and nome != "dim_sexo":
        df = pd.DataFrame(gpd.read_parquet(path))
        for col, srid in GEOMETRIAS.items():
            df[col] = shapely.to_wkb(shapely.set_srid(df[col].values, srid), hex=True, include_srid=True)
        return df
    return pd.read_parquet(path)


def copiar(cur, tabela, df):
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep="")
    buf.seek(0)
    colunas = sql.SQL(", ").join(map(sql.Identifier, df.columns))
    cur.copy_expert(sql.SQL("COPY atlas.{} ({}) FROM STDIN WITH (FORMAT csv, NULL '')")
                    .format(sql.Identifier(tabela), colunas).as_string(cur), buf)


def run(relatorio):
    contagem = {}
    with conectar() as conn, conn.cursor() as cur:
        cur.execute((SQL_DIR / "schema.sql").read_text())
        cur.executemany("INSERT INTO atlas.dim_sexo VALUES (%s, %s)", SEXOS.items())
        cur.executemany("INSERT INTO atlas.dim_raca VALUES (%s, %s, %s)",
                        [(k, v, k in RACAS_NEGRAS) for k, v in RACAS.items()])

        for tabela in ORDEM:
            df = _ler(tabela)
            copiar(cur, tabela, df)
            contagem[tabela] = len(df)
            print(f"  {tabela}: {len(df):,} linhas")

        manifest = json.loads((PROCESSED / "manifest_fontes.json").read_text())
        cur.executemany("INSERT INTO atlas.meta_fonte VALUES (%s, %s)",
                        [(f["arquivo"], json.dumps(f, ensure_ascii=False)) for f in manifest["fontes"]])

        cur.execute((SQL_DIR / "indices.sql").read_text())
        cur.execute((SQL_DIR / "views.sql").read_text())

        app_user = os.environ.get("APP_DB_USER", "atlas_app")
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (app_user,))
        if cur.fetchone():
            cur.execute(sql.SQL("GRANT USAGE ON SCHEMA atlas TO {u}; GRANT SELECT ON ALL TABLES IN SCHEMA atlas TO {u}")
                        .format(u=sql.Identifier(app_user)))

        cur.execute("""
            SELECT c.relname, c.reltuples::bigint, pg_total_relation_size(c.oid)
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'atlas' AND c.relkind IN ('r', 'm') ORDER BY 1""")
        tamanhos = {nome: {"linhas": linhas, "bytes": b} for nome, linhas, b in cur.fetchall()}
        relatorio["banco"] = {"linhas_carregadas": contagem, "tabelas": tamanhos,
                              "tamanho_schema_bytes": sum(t["bytes"] for t in tamanhos.values())}
        cur.execute("INSERT INTO atlas.meta_carga (relatorio) VALUES (%s)",
                    [json.dumps(relatorio, ensure_ascii=False, default=str)])
    print(f"  schema atlas: {relatorio['banco']['tamanho_schema_bytes'] / 1e6:.1f} MB")
