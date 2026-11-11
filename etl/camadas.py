import json

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.warp import calculate_default_transform, reproject

import geopandas as gpd
from config import WEB_CAMADAS

QUENTE = ["#fde7cf", "#fbca98", "#f6a865", "#ec8240", "#d65f24", "#b04416", "#7e2e0e"]
AZUL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]


def _colorir(arr, vmin, vmax, cores, log):
    rampa = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cores], dtype="float32")
    a, b, v = (np.log(vmin), np.log(vmax), np.log(arr)) if log else (vmin, vmax, arr)
    pos = np.nan_to_num(np.clip((v - a) / (b - a), 0, 1) * (len(cores) - 1))
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(cores) - 1)
    frac = (pos - i0)[..., None]
    rgb = rampa[i0] * (1 - frac) + rampa[i1] * frac
    alfa = np.where(np.isfinite(arr), 255, 0)[..., None]
    return np.concatenate([rgb, alfa], axis=2).astype("uint8").transpose(2, 0, 1)


def gerar(id_, titulo, arquivo, unidade, cores, recorte=None, log=False, arredonda=1):
    with rasterio.open(arquivo) as src:
        arr = src.read(1).astype("float32")
        if recorte is not None:
            arr = np.where(~geometry_mask([recorte.to_crs(src.crs).union_all()], src.shape, src.transform), arr, np.nan)
        t, w, h = calculate_default_transform(src.crs, "EPSG:3857", src.width, src.height, *src.bounds)
        web = np.full((h, w), np.nan, dtype="float32")
        reproject(arr, web, src_transform=src.transform, src_crs=src.crs, dst_transform=t, dst_crs="EPSG:3857",
                  resampling=Resampling.nearest, src_nodata=np.nan, dst_nodata=np.nan)

    validos = web[np.isfinite(web)]
    vmin = np.floor(np.percentile(validos, 2) / arredonda) * arredonda
    vmax = np.ceil(np.percentile(validos, 98) / arredonda) * arredonda

    WEB_CAMADAS.mkdir(parents=True, exist_ok=True)
    png = WEB_CAMADAS / f"{id_}.png"
    with rasterio.open(png, "w", driver="PNG", width=w, height=h, count=4, dtype="uint8") as dst:
        dst.write(_colorir(web, vmin, vmax, cores, log))
    for extra in WEB_CAMADAS.glob("*.aux.xml"):
        extra.unlink()

    x0, y1 = t * (0, 0)
    x1, y0 = t * (w, h)
    cantos = gpd.GeoSeries.from_xy([x0, x1, x1, x0], [y1, y1, y0, y0], crs="EPSG:3857").to_crs("EPSG:4326")
    info = {"id": id_, "titulo": titulo, "imagem": f"/camadas/{png.name}", "unidade": unidade,
            "cantos": [[round(p.x, 6), round(p.y, 6)] for p in cantos],
            "min": float(vmin), "max": float(vmax), "cores": cores, "log": log}

    indice = WEB_CAMADAS / "camadas.json"
    lista = [c for c in (json.loads(indice.read_text()) if indice.exists() else []) if c["id"] != id_]
    indice.write_text(json.dumps(sorted(lista + [info], key=lambda c: c["id"]), ensure_ascii=False, indent=1))
    return info
