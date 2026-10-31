from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW_IBGE = RAW / "ibge_setores"
RAW_GEO = RAW / "geo"
RAW_TABELAS = RAW / "tabelas"
PROCESSED = ROOT / "data" / "processed"
SQL_DIR = Path(__file__).resolve().parent / "sql"

COD_MUNICIPIO = "2927408"
CRS_IBGE = "EPSG:4674"
CRS_WEB = "EPSG:4326"
CHUNK_SIZE = 50_000

IBGE_FTP = ("https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/"
            "Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/")

FONTES_CSV = {
    "basico": "Agregados_por_setores_basico_BR_20260520.zip",
    "demografia": "Agregados_por_setores_demografia_BR.zip",
    "cor_ou_raca": "Agregados_por_setores_cor_ou_raca_BR.zip",
    "alfabetizacao": "Agregados_por_setores_alfabetizacao_BR.zip",
    "parentesco": "Agregados_por_setores_parentesco_BR.zip",
    "domicilio2": "Agregados_por_setores_caracteristicas_domicilio2_BR_20250417.zip",
}
FONTE_RENDA = "Agregados_por_setores_renda_responsavel_BR.csv"
DICIONARIO = "dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx"

ARQ_SETORES = RAW_GEO / "SETORES_CENSITARIO_SALVADOR.shp"
ARQ_FCU = RAW_GEO / "qg_2022_670_fcu_agreg.shp"
ARQ_NDVI = RAW_GEO / "NDVI.tif"

SEXOS = {1: "Masculino", 2: "Feminino"}
RACAS = {1: "Branca", 2: "Preta", 3: "Amarela", 4: "Parda", 5: "Indígena"}
RACAS_NEGRAS = (2, 4)

POP_SEXO_RACA = {f"V0{1322 + i}": (1 if i < 5 else 2, i % 5 + 1) for i in range(10)}

ALFAB_SEXO_RACA = {}
for i in range(10):
    sexo, raca = (1 if i < 5 else 2), i % 5 + 1
    ALFAB_SEXO_RACA[f"V00{916 + 2 * i}"] = (sexo, raca, "alfabetizados")
    ALFAB_SEXO_RACA[f"V00{917 + 2 * i}"] = (sexo, raca, "nao_alfabetizados")

VARS_BASICO = {"V0001": "populacao", "V0005": "media_moradores", "V0007": "domicilios_ocupados"}
VARS_DEMOGRAFIA = {"V01007": "homens", "V01008": "mulheres"}
VARS_PARENTESCO = {"V01062": "resp_homens", "V01063": "resp_mulheres"}
VARS_RENDA = {"V06001": "responsaveis", "V06004": "renda_media", "V06006": "renda_mediana"}

TEMAS_DOMICILIO = {
    "agua_rede": {
        "prefixo": "Utiliza ",
        "adequado": ["Utiliza rede geral de distribuição"],
    },
    "agua_encanada": {
        "prefixo": "Água ",
        "adequado": ["Água chega encanada até dentro da casa"],
    },
    "banheiro": {
        "prefixo": ("1 banheiro", "2 banheiros", "3 banheiros", "4 ou mais banheiros",
                    "Apenas banheiro", "Apenas sanitário", "Não tinham banheiro"),
        "adequado": ["1 banheiro", "2 banheiros", "3 banheiros", "4 ou mais banheiros"],
    },
    "esgoto_rede": {
        "prefixo": "Destinação do esgoto",
        "adequado": ["é rede geral ou pluvial", "é fossa séptica ou fossa filtro ligada à rede"],
    },
    "lixo_coletado": {
        "prefixo": ("Lixo ", "Outro destino do lixo"),
        "adequado": ["Lixo coletado no domicílio", "Lixo depositado em caçamba"],
    },
}
LIMIAR_NDVI_VEGETACAO = 0.3
