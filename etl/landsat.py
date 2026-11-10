import json
import urllib.request

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.fill import fillnodata
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT

from config import (ARQ_CENAS, ARQ_LST, ARQ_NDVI, ARQ_SETORES, CRS_LANDSAT, LANDSAT_ANO,
                    LANDSAT_NUVENS_MAX, RAW_LANDSAT)

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/landsat-c2-l2"
RES = 30
BITS_RUINS = 0b11111
BIT_AGUA = 1 << 7
DESVIO_CENA_MAX = 8
MIN_OBS = 3
PREENCHE_MAX_PX = 20


def _json(url, corpo=None):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode() if corpo else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def _grade():
    setores = gpd.read_file(ARQ_SETORES).to_crs(CRS_LANDSAT)
    x0, y0, x1, y1 = setores.total_bounds
    x0, y0 = np.floor(np.array([x0, y0]) / RES) * RES - RES * 10
    x1, y1 = np.ceil(np.array([x1, y1]) / RES) * RES + RES * 10
    largura, altura = int((x1 - x0) / RES), int((y1 - y0) / RES)
    bbox = list(gpd.GeoSeries.from_xy([x0, x1], [y0, y1], crs=CRS_LANDSAT).to_crs("EPSG:4326").total_bounds)
    return from_origin(x0, y1, RES, RES), largura, altura, bbox


def _cenas(bbox):
    corpo = {
        "collections": ["landsat-c2-l2"], "bbox": bbox, "limit": 100,
        "datetime": f"{LANDSAT_ANO}-01-01/{LANDSAT_ANO}-12-31",
        "query": {"eo:cloud_cover": {"lt": LANDSAT_NUVENS_MAX}, "platform": {"in": ["landsat-8", "landsat-9"]}},
    }
    return sorted(_json(STAC, corpo)["features"], key=lambda f: f["properties"]["datetime"])


def _banda(href, token, transform, largura, altura):
    with rasterio.Env(GDAL_HTTP_TIMEOUT=60, GDAL_HTTP_MAX_RETRY=5, GDAL_HTTP_RETRY_DELAY=3), \
            rasterio.open(f"{href}?{token}") as src, WarpedVRT(
            src, crs=CRS_LANDSAT, transform=transform, width=largura, height=altura,
            resampling=Resampling.nearest, src_nodata=0, nodata=0) as vrt:
        return vrt.read(1)


def _salvar(path, arr, transform):
    perfil = {"driver": "GTiff", "dtype": "float32", "count": 1, "crs": CRS_LANDSAT, "transform": transform,
              "width": arr.shape[1], "height": arr.shape[0], "nodata": np.nan, "compress": "deflate"}
    with rasterio.open(path, "w", **perfil) as dst:
        dst.write(arr.astype("float32"), 1)


def run():
    if ARQ_LST.exists() and ARQ_NDVI.exists() and ARQ_CENAS.exists():
        return json.loads(ARQ_CENAS.read_text())

    transform, largura, altura, bbox = _grade()
    cenas = _cenas(bbox)
    token = _json(TOKEN)["token"]
    print(f"  {len(cenas)} cenas Landsat 8/9 de {LANDSAT_ANO} sobre Salvador")

    lst, ndvi, agua, usadas = [], [], [], []
    for f in cenas:
        if not f["id"].endswith("_T1"):
            continue
        a = {k: f["assets"][k]["href"] for k in ("red", "nir08", "lwir11", "qa_pixel")}
        qa = _banda(a["qa_pixel"], token, transform, largura, altura)
        limpo = (qa != 0) & ((qa & BITS_RUINS) == 0)
        if limpo.mean() < 0.05:
            continue
        st = _banda(a["lwir11"], token, transform, largura, altura).astype("float32")
        red = _banda(a["red"], token, transform, largura, altura).astype("float32") * 2.75e-5 - 0.2
        nir = _banda(a["nir08"], token, transform, largura, altura).astype("float32") * 2.75e-5 - 0.2
        with np.errstate(divide="ignore", invalid="ignore"):
            n = (nir - red) / (nir + red)
        agua.append(np.where(limpo, (qa & BIT_AGUA) != 0, np.nan))
        lst.append(np.where(limpo & (st > 0), st * 0.00341802 + 149.0 - 273.15, np.nan))
        ndvi.append(np.where(limpo & np.isfinite(n) & (np.abs(n) <= 1), n, np.nan))
        usadas.append({"id": f["id"], "data": f["properties"]["datetime"][:10],
                       "plataforma": f["properties"]["platform"],
                       "nuvens_cena": f["properties"]["eo:cloud_cover"],
                       "pct_pixels_limpos": round(float(limpo.mean() * 100), 1)})
        print(f"    {f['id']}: {usadas[-1]['pct_pixels_limpos']}% limpo")

    medianas = np.array([np.nanmedian(t) for t in lst])
    referencia = np.median(medianas)
    for c, m in zip(usadas, medianas):
        c["mediana_c"] = round(float(m), 2)
        c["descartada"] = bool(abs(m - referencia) > DESVIO_CENA_MAX)
    boas = [i for i, c in enumerate(usadas) if not c["descartada"]]
    pilha_lst, pilha_ndvi = np.stack([lst[i] for i in boas]), np.stack([ndvi[i] for i in boas])
    with np.errstate(all="ignore"):
        e_agua = np.nanmean(np.stack([agua[i] for i in boas]), axis=0) > 0.5
    with np.errstate(all="ignore"):
        temp = np.where(np.isfinite(pilha_lst).sum(axis=0) >= MIN_OBS, np.nanmedian(pilha_lst, axis=0), np.nan)
        veg = np.where(np.isfinite(pilha_ndvi).sum(axis=0) >= MIN_OBS, np.nanmedian(pilha_ndvi, axis=0), np.nan)
    terra = ~e_agua & np.isfinite(veg)
    temp = np.where(terra, temp, np.nan)
    falhas = terra & ~np.isfinite(temp)
    preenchida = fillnodata(np.nan_to_num(temp), mask=np.isfinite(temp), max_search_distance=PREENCHE_MAX_PX)
    temp = np.where(terra, np.where(falhas, preenchida, temp), np.nan)
    temp[falhas & (preenchida == 0)] = np.nan

    RAW_LANDSAT.mkdir(parents=True, exist_ok=True)
    _salvar(ARQ_LST, temp, transform)
    _salvar(ARQ_NDVI, np.where(terra, veg, np.nan), transform)
    info = {"fonte": "USGS Landsat Collection 2 Level-2 via Microsoft Planetary Computer",
            "stac": STAC, "ano": LANDSAT_ANO, "cenas_encontradas": len(cenas),
            "composicao": (f"mediana por pixel das cenas Tier 1, nuvens e sombras removidas (QA_PIXEL); "
                           f"cena descartada se a mediana dela difere mais de {DESVIO_CENA_MAX} °C da mediana das cenas; "
                           f"pixel exige {MIN_OBS} observações limpas; água (bit 7 do QA_PIXEL em mais da metade das observações) removida; "
                           f"falhas fixas da temperatura em terra (lacunas de emissividade ASTER GED) preenchidas por "
                           f"interpolação dos vizinhos até {PREENCHE_MAX_PX * RES} m"),
            "pixels_terra": int(terra.sum()), "pixels_temperatura_preenchidos": int(falhas.sum()),
            "cenas": usadas}
    ARQ_CENAS.write_text(json.dumps(info, ensure_ascii=False, indent=2))
    return info

