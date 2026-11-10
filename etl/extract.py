import hashlib
import json
import urllib.request
from datetime import datetime, timezone

import landsat
from config import (ARQ_CENAS, ARQ_FCU, ARQ_LST, ARQ_NDVI, ARQ_SETORES, DICIONARIO, FONTE_RENDA, FONTES_CSV,
                    IBGE_FTP, LANDSAT_ANO, PROCESSED, RAW_IBGE, RAW_TABELAS)

ORIGEM_LOCAL = {
    ARQ_SETORES.name: "IBGE - Malha de setores censitários 2022 (recorte Salvador)",
    ARQ_FCU.name: "IBGE - Favelas e Comunidades Urbanas 2022 (polígonos, Brasil)",
    FONTE_RENDA: "IBGE - Agregados por setores, renda do responsável",
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def baixar(nome, url):
    destino = RAW_IBGE / nome
    if destino.exists():
        return destino
    print(f"  baixando {nome} ...")
    RAW_IBGE.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(destino)
    return destino


def registro(path, url=None, descricao=None):
    return {
        "arquivo": path.name,
        "url": url,
        "descricao": descricao or ORIGEM_LOCAL.get(path.name),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def run():
    manifest = []
    for chave, nome in FONTES_CSV.items():
        url = IBGE_FTP + nome
        manifest.append(registro(baixar(nome, url), url, f"IBGE - Agregados por setores, {chave}"))
    dic_url = IBGE_FTP.rsplit("/", 2)[0] + "/" + DICIONARIO
    manifest.append(registro(baixar(DICIONARIO, dic_url), dic_url, "IBGE - Dicionário dos agregados"))

    for path in [RAW_IBGE / FONTE_RENDA, ARQ_SETORES, ARQ_FCU]:
        if not path.exists():
            raise FileNotFoundError(f"Arquivo local obrigatório ausente: {path}")
        manifest.append(registro(path))
    cenas = landsat.run()
    ids = ", ".join(c["id"] for c in cenas["cenas"])
    for path, nome in [(ARQ_LST, "temperatura da superfície (°C)"), (ARQ_NDVI, "NDVI")]:
        manifest.append(registro(path, cenas["stac"], f"Landsat 8/9 C2 L2, {nome}, mediana de {LANDSAT_ANO}: {ids}"))
    manifest.append(registro(ARQ_CENAS, cenas["stac"], "Lista das cenas Landsat usadas na composição"))
    for path in sorted(RAW_TABELAS.glob("*.xlsx")):
        manifest.append(registro(path, descricao="IBGE - Censo 2022, tabela de resultados (XLSX)"))

    PROCESSED.mkdir(parents=True, exist_ok=True)
    saida = {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fontes": manifest}
    (PROCESSED / "manifest_fontes.json").write_text(json.dumps(saida, ensure_ascii=False, indent=2))
    print(f"  {len(manifest)} fontes registradas")
    return manifest


if __name__ == "__main__":
    run()
