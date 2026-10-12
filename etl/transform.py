import re

import pandas as pd

from config import (ALFAB_SEXO_RACA, CHUNK_SIZE, COD_MUNICIPIO, DICIONARIO, FONTE_RENDA, FONTES_CSV,
                    POP_SEXO_RACA, RACAS, RAW_IBGE, SEXOS, TEMAS_DOMICILIO, VARS_BASICO,
                    VARS_DEMOGRAFIA, VARS_PARENTESCO, VARS_RENDA)


def _eh_chave(coluna):
    return coluna.upper() in {"CD_SETOR", "SETOR"}


def ler_salvador(arquivo, variaveis, relatorio, nome):
    variaveis = list(variaveis)
    path = RAW_IBGE / arquivo
    compressao = "zip" if path.suffix == ".zip" else None
    total_colunas = len(pd.read_csv(path, sep=";", nrows=0, compression=compressao, encoding="latin-1").columns)

    linhas_lidas, partes = 0, []
    for chunk in pd.read_csv(path, sep=";", dtype=str, chunksize=CHUNK_SIZE, compression=compressao,
                             encoding="latin-1", usecols=lambda c: _eh_chave(c) or c.upper() in variaveis):
        linhas_lidas += len(chunk)
        chunk.columns = [c.upper() for c in chunk.columns]  # o básico vem com "v0001" minúsculo
        chave = next(c for c in chunk.columns if _eh_chave(c))
        chunk = chunk[chunk[chave].str.startswith(COD_MUNICIPIO, na=False)]
        if len(chunk):
            partes.append(chunk.rename(columns={chave: "cd_setor"}))
    bruto = pd.concat(partes, ignore_index=True)

    faltando = set(variaveis) - set(bruto.columns)
    if faltando:
        raise KeyError(f"{arquivo}: variáveis ausentes {sorted(faltando)}")

    valores = bruto[variaveis]
    sigilo = int((valores == "X").sum().sum())
    # "X" = sigilo do IBGE; vira NULL junto com "." e vazio
    numerico = valores.apply(lambda s: pd.to_numeric(s.str.replace(",", ".", regex=False), errors="coerce"))
    duplicados = int(bruto["cd_setor"].duplicated().sum())
    df = numerico.set_index(bruto["cd_setor"])
    df = df[~df.index.duplicated(keep="first")]

    relatorio[nome] = {
        "arquivo": arquivo,
        "linhas_lidas_brasil": linhas_lidas,
        "colunas_no_arquivo": total_colunas,
        "linhas_salvador": len(df),
        "colunas_mantidas": len(variaveis),
        "celulas_sigilo_X": sigilo,
        "celulas_nulas": int(df.isna().sum().sum()),
        "setores_duplicados_removidos": duplicados,
    }
    print(f"  {nome}: {linhas_lidas:,} linhas -> {len(df):,} de Salvador "
          f"({len(variaveis)}/{total_colunas} colunas, {sigilo:,} células X)")
    return df


def _para_longo(df, mapa, colunas_id):
    longo = df.reset_index().melt(id_vars="cd_setor", var_name="variavel", value_name="valor")
    chaves = pd.DataFrame.from_dict(mapa, orient="index", columns=colunas_id)
    return longo.join(chaves, on="variavel")


def fato_populacao(relatorio):
    df = ler_salvador(FONTES_CSV["cor_ou_raca"], POP_SEXO_RACA, relatorio, "cor_ou_raca")
    out = _para_longo(df, POP_SEXO_RACA, ["id_sexo", "id_raca"]).rename(columns={"valor": "pessoas"})
    out = out[["cd_setor", "id_sexo", "id_raca", "pessoas"]].astype({"pessoas": "Int32"})
    return out.sort_values(["cd_setor", "id_sexo", "id_raca"], ignore_index=True)


def fato_alfabetizacao(relatorio):
    df = ler_salvador(FONTES_CSV["alfabetizacao"], ALFAB_SEXO_RACA, relatorio, "alfabetizacao")
    longo = _para_longo(df, ALFAB_SEXO_RACA, ["id_sexo", "id_raca", "medida"])
    out = longo.pivot_table(index=["cd_setor", "id_sexo", "id_raca"], columns="medida",
                            values="valor", aggfunc="first", dropna=False).reset_index()
    out.columns.name = None
    out = out.astype({"alfabetizados": "Int32", "nao_alfabetizados": "Int32"})
    return out[["cd_setor", "id_sexo", "id_raca", "alfabetizados", "nao_alfabetizados"]]


def variaveis_domicilio():
    dic = pd.read_excel(RAW_IBGE / DICIONARIO, sheet_name="Dicionário não PCT", header=None, dtype=str)
    dic = dic.dropna(how="all", axis=1).iloc[:, :4]
    dic.columns = ["entidade", "tema", "variavel", "descricao"]
    dic = dic[dic["tema"].str.contains("Domicílio - Parte 2", na=False)]

    padrao = re.compile(r"Domicílios Particulares Permanentes Ocupados, (?P<categoria>.+), "
                        r"(?P<dim>Cor ou raça|Sexo) da pessoa responsável pelo domicílio é (?P<grupo>\w+)$")
    sexo_id = {v.lower(): k for k, v in SEXOS.items()}
    raca_id = {v.lower(): k for k, v in RACAS.items()}
    linhas = []
    for variavel, descricao in zip(dic["variavel"], dic["descricao"]):
        m = padrao.match(str(descricao).strip())
        if not m:
            continue
        categoria, grupo = m["categoria"], m["grupo"].lower()
        for tema, regra in TEMAS_DOMICILIO.items():
            if categoria.startswith(regra["prefixo"]):
                linhas.append({
                    "variavel": variavel, "tema": tema, "categoria": categoria,
                    "adequado": any(a in categoria for a in regra["adequado"]),
                    "id_sexo": sexo_id.get(grupo) if m["dim"] == "Sexo" else None,
                    "id_raca": raca_id.get(grupo) if m["dim"] != "Sexo" else None,
                })
                break
    vars_ = pd.DataFrame(linhas)
    if vars_.empty or vars_[["id_sexo", "id_raca"]].isna().all(axis=1).any():
        raise ValueError("não consegui classificar as variáveis de domicílio pelo dicionário")
    return vars_


def fato_domicilio_responsavel(relatorio):
    vars_ = variaveis_domicilio()
    df = ler_salvador(FONTES_CSV["domicilio2"], vars_["variavel"], relatorio, "domicilio2")
    longo = df.reset_index().melt(id_vars="cd_setor", var_name="variavel", value_name="valor").merge(vars_)
    longo["sigilo"] = longo["valor"].isna()
    longo["valor_adequado"] = longo["valor"].where(longo["adequado"])

    chaves = ["cd_setor", "tema", "id_sexo", "id_raca"]
    out = (longo.groupby(chaves, dropna=False)
           .agg(domicilios_adequados=("valor_adequado", lambda s: s.sum(min_count=1)),
                domicilios_total=("valor", lambda s: s.sum(min_count=1)),
                possui_sigilo=("sigilo", "any"))
           .reset_index())
    out = out.astype({"domicilios_adequados": "Int32", "domicilios_total": "Int32",
                      "id_sexo": "Int16", "id_raca": "Int16"})

    relatorio["domicilio2"]["variaveis_classificadas"] = len(vars_)
    relatorio["domicilio2"]["categorias_por_tema"] = (
        vars_.drop_duplicates(["tema", "categoria"]).groupby("tema")["categoria"].apply(list).to_dict())
    return out.sort_values(chaves, ignore_index=True)


def fato_setor(relatorio):
    fontes = [
        (FONTES_CSV["basico"], VARS_BASICO, "basico"),
        (FONTES_CSV["demografia"], VARS_DEMOGRAFIA, "demografia"),
        (FONTES_CSV["parentesco"], VARS_PARENTESCO, "parentesco"),
        (FONTE_RENDA, VARS_RENDA, "renda"),
    ]
    dfs = [ler_salvador(arq, vars_, relatorio, nome).rename(columns=vars_) for arq, vars_, nome in fontes]
    out = dfs[0].join(dfs[1:], how="outer")
    out.index.name = "cd_setor"
    inteiros = ["populacao", "domicilios_ocupados", "homens", "mulheres", "resp_homens", "resp_mulheres",
                "responsaveis"]
    return out.astype({c: "Int32" for c in inteiros}).reset_index()


def checar_particao(dom):
    # o total de domicílios por sexo do responsável tem que ser parecido em todos os temas
    tot = dom[dom["id_sexo"].notna()].groupby("tema")["domicilios_total"].sum()
    return {k: int(v) for k, v in tot.items()}
