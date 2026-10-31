import warnings

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.mask import mask
from shapely.geometry import MultiPolygon

from config import (ARQ_FCU, ARQ_NDVI, ARQ_SETORES, COD_MUNICIPIO, CRS_IBGE, CRS_WEB,
                    LIMIAR_NDVI_VEGETACAO)

TOLERANCIA_WEB = 0.00003


def _multi(geom):
    return MultiPolygon([geom]) if geom.geom_type == "Polygon" else geom


def _geom_web(gdf):
    web = gdf.geometry.to_crs(CRS_WEB).simplify(TOLERANCIA_WEB, preserve_topology=True)
    return web.apply(_multi)


def _ler_setores():
    gdf = gpd.read_file(ARQ_SETORES).to_crs(CRS_IBGE)
    invalidas = int((~gdf.is_valid).sum())
    if invalidas:
        gdf["geometry"] = gdf.geometry.make_valid()
    return gdf, invalidas


def dim_setor(relatorio):
    gdf, invalidas = _ler_setores()
    out = gpd.GeoDataFrame({
        "cd_setor": gdf["CD_SETOR"].astype(str),
        "cd_bairro": gdf["CD_BAIRRO"],
        "cd_subdistrito": gdf["CD_SUBDIST"],
        "nm_subdistrito": gdf["NM_SUBDIST"],
        "cd_fcu": gdf["CD_FCU"],
        "situacao": gdf["SITUACAO"],
        "cd_tipo": pd.to_numeric(gdf["CD_TIPO"], errors="coerce").astype("Int16"),
        "area_km2": gdf["AREA_KM2"].round(6),
        "em_favela": gdf["CD_FCU"].notna(),
    }, geometry=gdf.geometry.apply(_multi), crs=CRS_IBGE)
    out = out[out["cd_setor"].str.startswith(COD_MUNICIPIO)].drop_duplicates("cd_setor").rename_geometry("geom")
    out["geom_web"] = _geom_web(out)

    relatorio["setores_shp"] = {
        "linhas_lidas": len(gdf), "linhas_finais": len(out), "geometrias_invalidas_corrigidas": invalidas,
        "setores_sem_bairro": int(out["cd_bairro"].isna().sum()),
        "setores_em_favela": int(out["em_favela"].sum()),
    }
    return out.reset_index(drop=True)


def dim_bairro():
    gdf, _ = _ler_setores()
    gdf = gdf[gdf["CD_BAIRRO"].notna()]
    nomes = gdf.groupby("CD_BAIRRO")["NM_BAIRRO"].first()
    dissolvido = gdf[["CD_BAIRRO", "geometry"]].dissolve(by="CD_BAIRRO")
    out = gpd.GeoDataFrame({
        "cd_bairro": dissolvido.index,
        "nm_bairro": nomes.reindex(dissolvido.index).values,
    }, geometry=dissolvido.geometry.apply(_multi).values, crs=CRS_IBGE).rename_geometry("geom")
    out["geom_web"] = _geom_web(out)
    return out.reset_index(drop=True)


def dim_fcu(relatorio):
    gdf = gpd.read_file(ARQ_FCU)
    lidas = len(gdf)
    gdf = gdf[gdf["cd_mun"] == COD_MUNICIPIO].to_crs(CRS_IBGE)
    out = gpd.GeoDataFrame({
        "cd_fcu": gdf["cd_fcu"].astype(str),
        "nm_fcu": gdf["nm_fcu"],
    }, geometry=gdf.geometry.apply(_multi), crs=CRS_IBGE).drop_duplicates("cd_fcu").rename_geometry("geom")
    out["area_km2"] = out.to_crs("EPSG:31984").area.div(1e6).round(6)
    out["geom_web"] = _geom_web(out)
    relatorio["fcu_shp"] = {"linhas_lidas_brasil": lidas, "linhas_salvador": len(out)}
    return out.reset_index(drop=True)


def _pixels(src, geom, all_touched):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        arr, _ = mask(src, [geom], crop=True, all_touched=all_touched, filled=True, nodata=src.nodata)
    v = arr[0]
    return v[np.isfinite(v) & (v != src.nodata) & (v >= -1) & (v <= 1)]


def ndvi_por_setor(setores, relatorio):
    linhas, pequenos = [], 0
    with rasterio.open(ARQ_NDVI) as src:
        for cd, geom in zip(setores["cd_setor"], setores.geometry.to_crs(src.crs)):
            try:
                v = _pixels(src, geom, all_touched=False)
                if v.size == 0:
                    v = _pixels(src, geom, all_touched=True)
                    pequenos += 1
            except ValueError:
                v = np.array([])
            if v.size:
                linhas.append((cd, float(v.mean()), float((v >= LIMIAR_NDVI_VEGETACAO).mean() * 100), int(v.size)))
            else:
                linhas.append((cd, None, None, 0))
    out = pd.DataFrame(linhas, columns=["cd_setor", "ndvi_medio", "pct_vegetacao", "ndvi_pixels"])
    relatorio["ndvi"] = {
        "crs_raster": "EPSG:32624", "resolucao_m": 30, "limiar_vegetacao": LIMIAR_NDVI_VEGETACAO,
        "setores_com_valor": int(out["ndvi_medio"].notna().sum()),
        "setores_pequenos_all_touched": pequenos,
        "setores_sem_pixel": int(out["ndvi_medio"].isna().sum()),
    }
    return out
