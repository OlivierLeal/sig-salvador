from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW_IBGE = RAW / "ibge_setores"
RAW_GEO = RAW / "geo"
RAW_TABELAS = RAW / "tabelas"
PROCESSED = ROOT / "data" / "processed"
SQL_DIR = Path(__file__).resolve().parent / "sql"
WEB_CAMADAS = ROOT / "web" / "public" / "camadas"

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
    "domicilio1": "Agregados_por_setores_caracteristicas_domicilio1_BR_20261021.zip",
    "domicilio3": "Agregados_por_setores_caracteristicas_domicilio3_BR_20250417.zip",
    "obitos": "Agregados_por_setores_obitos_BR.zip",
    "quilombolas": "Agregados_por_setores_pessoas_quilombolas_BR.zip",
}
FONTE_RENDA = "Agregados_por_setores_renda_responsavel_BR.csv"
DICIONARIO = "dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx"

ARQ_SETORES = RAW_GEO / "SETORES_CENSITARIO_SALVADOR.shp"
ARQ_FCU = RAW_GEO / "qg_2022_670_fcu_agreg.shp"
RAW_LANDSAT = RAW / "landsat"
ARQ_LST = RAW_LANDSAT / "lst_2022.tif"
ARQ_NDVI = RAW_LANDSAT / "ndvi_2022.tif"
ARQ_CENAS = RAW_LANDSAT / "cenas_2022.json"
LANDSAT_ANO = 2022
ARQ_KRIGAGEM = PROCESSED / "krigagem_renda_media.tif"
LANDSAT_NUVENS_MAX = 60
CRS_LANDSAT = "EPSG:32624"

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
# composição do domicílio por sexo do responsável; V01203/V01204 = monoparental
VARS_PARENTESCO.update({f"V0{v}": f"arranjo_{v}" for v in range(1197, 1207)})
VARS_DOMICILIO1 = {
    "V00001": "dom_permanentes",
    "V00002": "dom_improvisados",
    "V00006": "pessoas_improvisados",
    "V00050": "dom_corticos",
    "V00052": "dom_degradados",
    **{f"V000{v}": f"dom_mor_{v}" for v in range(22, 27)},  # 6+ moradores
}
VARS_OBITOS_SETOR = {"V01226": "obitos_homens", "V01227": "obitos_mulheres"}  # jan/2019 a jul/2022
MESES_OBITOS = 43
# óbitos e quilombolas: X vale 1 ou 2; nas views entra como 1,5
VARS_QUILOMBOLAS = {"V03196": "pop_quilombola", "V03197": "quilombolas_homens", "V03198": "quilombolas_mulheres"}

FAIXAS_IDADE = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-39", "40-49", "50-59", "60-69", "70+"]
IDADE_SEXO = {f"V0{1009 + i}": (1 if i < 11 else 2, FAIXAS_IDADE[i % 11]) for i in range(22)}

FAIXAS_OBITO = ["0-14", "15-29", "30-59", "60+"]
OBITO_ANO_SEXO_IDADE = {f"V0{1285 + i}": (2019 + i // 8, 1 if i % 8 < 4 else 2, FAIXAS_OBITO[i % 4]) for i in range(32)}
OBITO_RACA_RESP = {}
for i, raca in enumerate([1, 2, 3, 4, 5]):
    OBITO_RACA_RESP[f"V0{1254 + 2 * i}"] = (raca, "dom_com_obito")
    OBITO_RACA_RESP[f"V0{1255 + 2 * i}"] = (raca, "dom_sem_obito")

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
