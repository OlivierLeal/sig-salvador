import re

import openpyxl
import pandas as pd

from config import RAW_TABELAS

RECORTES = {"Brasil": "Brasil", "Nordeste": "Nordeste", "Bahia": "Bahia", "Salvador (BA)": "Salvador"}

TABELAS = {
    "Tabela_01_Variacao_cor_ou_raca_2010_2022_BR_GR_UF.xlsx": (5, 6, 7, 1, None),
    "Tabela_06_Razao_de_sexos_por_cor_ou_raca_e_das_pessoas_indíigenas_2022_BR_UF.xlsx": (6, 7, 8, 2, "razão de sexos"),
    "Tabela_8_Local_de_trabalho.xlsx": (2, 3, 4, 1, "%"),
    "Tabela_9_Tempo_de_deslocamento_para_o_trabalho.xlsx": (2, 3, 4, 1, "%"),
    "Tabela_11_Domicilios_sem_presenca_de_conjuge_e_com_filhos.xlsx": (2, 3, 4, 1, "%"),
    "Tabela_13_Meio_de_transporte.xlsx": (2, 3, 4, 1, "%"),
    "Tabela_14_Conjuge_e_deficiencia.xlsx": (2, 3, 4, 1, "%"),
    "Tabela_15_Maquina_de_lavar_roupa_e_internet.xlsx": (2, 3, 4, 1, "%"),
    "Tabela_16_Caracteristicas_domicilio_e_territorio.xlsx": (2, 3, 4, 1, "%"),
}


def _texto(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else None


def ler_tabela(arquivo, linha_grupo, linha_cat, linha_dados, col_valor, unidade):
    ws = openpyxl.load_workbook(RAW_TABELAS / arquivo, read_only=True, data_only=True).worksheets[0]
    linhas = list(ws.iter_rows(values_only=True))
    titulo = next(_texto(c) for r in linhas[:4] for c in r if c and str(c).strip().startswith("Tabela"))
    numero = re.match(r"Tabela (\d+)", titulo).group(1)

    grupos, atual = [], None
    for c in linhas[linha_grupo - 1]:
        atual = _texto(c) or atual
        grupos.append(atual)
    cabecalho_grupo = [_texto(c) for c in linhas[linha_grupo - 1]]
    categorias = [_texto(c) for c in linhas[linha_cat - 1]]

    registros = []
    for r in linhas[linha_dados - 1:]:
        recorte = RECORTES.get(_texto(r[0]))
        if not recorte:
            continue
        for j in range(col_valor, min(len(r), len(grupos))):
            categoria = categorias[j] if j < len(categorias) else None
            if not categoria and not cabecalho_grupo[j]:
                continue
            categoria = categoria or grupos[j]
            valor = pd.to_numeric(r[j], errors="coerce")
            registros.append({
                "tabela": int(numero), "titulo": titulo, "recorte": recorte,
                "grupo": grupos[j], "categoria": categoria, "valor": valor,
                "unidade": unidade or ("%" if "%" in categoria else "pessoas"),
            })
    return registros


def ref_contexto(relatorio):
    registros = []
    for arquivo, params in TABELAS.items():
        registros += ler_tabela(arquivo, *params)
    df = pd.DataFrame(registros)
    relatorio["tabelas_xlsx"] = {
        "arquivos": len(TABELAS), "linhas": len(df),
        "valores_nulos": int(df["valor"].isna().sum()),
        "recortes": sorted(df["recorte"].unique().tolist()),
    }
    print(f"  tabelas xlsx: {len(TABELAS)} arquivos -> {len(df)} linhas")
    return df
