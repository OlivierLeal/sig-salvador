import argparse
import json
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

import contexto
import extract
import geo
import load
import transform
from config import PROCESSED, ROOT

ETAPAS = ["extract", "transform", "load"]


def etapa_transform(relatorio):
    setores = geo.dim_setor(relatorio)
    bairros = geo.dim_bairro()
    fcus = geo.dim_fcu(relatorio)
    ndvi = geo.ndvi_por_setor(setores, relatorio)

    fatos = {
        "fato_setor": transform.fato_setor(relatorio),
        "fato_populacao": transform.fato_populacao(relatorio),
        "fato_alfabetizacao": transform.fato_alfabetizacao(relatorio),
        "fato_domicilio_resp": transform.fato_domicilio_responsavel(relatorio),
    }
    relatorio["checagem_particao_domicilios"] = transform.checar_particao(fatos["fato_domicilio_resp"])

    # setor de fato sem polígono na malha não entra (FK)
    validos = set(setores["cd_setor"])
    for nome, df in fatos.items():
        orfaos = ~df["cd_setor"].isin(validos)
        relatorio.setdefault("setores_sem_geometria", {})[nome] = int(df.loc[orfaos, "cd_setor"].nunique())
        fatos[nome] = df[~orfaos]

    # todo setor da malha ganha linha em fato_setor (com NDVI), mesmo sem dado do censo
    relatorio["setores_sem_dados_censo"] = len(validos - set(fatos["fato_setor"]["cd_setor"]))
    fatos["fato_setor"] = (setores[["cd_setor"]].merge(fatos["fato_setor"], how="left")
                           .merge(ndvi, how="left"))

    PROCESSED.mkdir(parents=True, exist_ok=True)
    for nome, gdf in {"dim_setor": setores, "dim_bairro": bairros, "dim_fcu": fcus}.items():
        gdf.to_parquet(PROCESSED / f"{nome}.parquet")
    for nome, df in fatos.items():
        df.to_parquet(PROCESSED / f"{nome}.parquet", index=False)
    contexto.ref_contexto(relatorio).to_parquet(PROCESSED / "ref_contexto.parquet", index=False)

    setores.drop(columns="geom_web").merge(fatos["fato_setor"], on="cd_setor", how="left").to_file(
        PROCESSED / "setores_salvador.gpkg", layer="setores", driver="GPKG")


def main():
    parser = argparse.ArgumentParser(description="ETL do Atlas da Desigualdade de Salvador")
    parser.add_argument("--etapas", default=",".join(ETAPAS))
    etapas = parser.parse_args().etapas.split(",")
    load_dotenv(ROOT / ".env")

    caminho = PROCESSED / "relatorio_etl.json"
    relatorio = json.loads(caminho.read_text()) if caminho.exists() and "transform" not in etapas else {}
    relatorio["executado_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for etapa in ETAPAS:
        if etapa not in etapas:
            continue
        print(f"[{etapa}]")
        inicio = time.time()
        if etapa == "extract":
            extract.run()
        elif etapa == "transform":
            etapa_transform(relatorio)
        else:
            load.run(relatorio)
        relatorio.setdefault("duracao_s", {})[etapa] = round(time.time() - inicio, 1)

    caminho.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
