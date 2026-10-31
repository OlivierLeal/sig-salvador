# Atlas da Desigualdade de Salvador

Projeto prático de Big Data e Analytics (UCSal). Um SIG web que cruza raça, gênero, renda, saneamento e vegetação nos 4.542 setores censitários de Salvador, comparando as Favelas e Comunidades Urbanas (FCUs) com o resto da cidade. Alinhado às ODS 5 (igualdade de gênero) e 18 (igualdade étnico-racial).

**Pergunta:** os setores dentro de favelas concentram mais população negra, mais domicílios chefiados por mulheres, menos renda, pior saneamento e menos vegetação? Dentro do mesmo território, a mulher negra está em desvantagem em relação ao homem branco?

```
etl/          extração, tratamento e carga (Python)
  sql/        schema, índices e views do banco
terraform/    infraestrutura na Aiven (PostgreSQL + usuário do app)
web/          painel Next.js (entrega 2)
data/
  raw/        arquivos originais (fora do Git, ver "Execução")
  processed/  base tratada (Parquet + GeoPackage) e relatórios do ETL
```

## Arquitetura

```mermaid
flowchart LR
  A["IBGE: CSVs por setor (Brasil, ~2,3 GB)"] --> E
  B["Malhas: setores, FCUs"] --> E
  C["NDVI.tif (30 m)"] --> E
  D["Tabelas XLSX do Censo"] --> E
  E["ETL Python<br/>extract → transform → load"] --> P[("Aiven PostgreSQL + PostGIS")]
  T["Terraform"] -. provisiona .-> P
  P --> W["Next.js no AWS Amplify<br/>rotas /api + mapa"]
```

O ETL roda em lote, localmente ou pelo GitHub Actions (`.github/workflows/etl.yml`). O painel lê o banco por rotas de API no servidor, então a credencial nunca vai para o navegador.

## Dados utilizados

As fontes tabulares e as malhas são públicas, do IBGE (Censo Demográfico 2022). O NDVI foi calculado pela equipe a partir de imagem Landsat. O recorte é o município de Salvador (código `2927408`).

| Fonte | Tipo | Linhas lidas (Brasil) | Colunas no arquivo | Linhas Salvador | Colunas usadas |
|---|---|---:|---:|---:|---:|
| Agregados por setor: básico | CSV | 468.099 | 38 | 4.542 | 3 |
| Agregados por setor: demografia | CSV | 458.772 | 37 | 4.504 | 2 |
| Agregados por setor: parentesco | CSV | 458.772 | 183 | 4.504 | 2 |
| Agregados por setor: renda do responsável | CSV | 458.772 | 7 | 4.504 | 3 |
| Agregados por setor: cor ou raça | CSV | 458.772 | 96 | 4.504 | 10 |
| Agregados por setor: alfabetização | CSV | 458.772 | 363 | 4.504 | 20 |
| Agregados por setor: características do domicílio 2 | CSV | 458.772 | 407 | 4.504 | 224 |
| Malha de setores censitários (Salvador) | Shapefile | 4.542 | | 4.542 | |
| Favelas e Comunidades Urbanas 2022 | Shapefile | 12.348 | | 262 | |
| NDVI de Salvador (Landsat, cálculo próprio) | GeoTIFF, 30 m, WGS 84 / UTM 24N | 1426 × 1045 px | | | |
| Tabelas de resultados 01, 06, 08, 09, 11, 13, 14, 15, 16 | XLSX | | | 360 valores | |
| Dicionário dos agregados | XLSX | | | | |

O NDVI foi calculado a partir de uma cena Landsat com as bandas do vermelho e do infravermelho próximo, `(NIR − Red) / (NIR + Red)`, e recortado para Salvador. O raster segue a convenção do Landsat de usar a zona UTM norte também no hemisfério sul, por isso o CRS é EPSG:32624 com coordenada Y negativa.

Limitação: a data da cena não foi registrada no cálculo. A vegetação pode não corresponder ao mesmo ano do Censo 2022, então o NDVI deve ser lido como indicador aproximado da cobertura vegetal, não como retrato de 2022.

URL, tamanho e hash SHA-256 de cada arquivo ficam em `data/processed/manifest_fontes.json` e na tabela `atlas.meta_fonte`.

### Os 5 V's

- **Volume:** os CSVs nacionais somam cerca de 2,3 GB descompactados. O ETL lê em blocos de 50 mil linhas e guarda só Salvador, cerca de 1% das linhas e 264 das 1.131 colunas. O banco final ocupa 73 MB, dentro do limite de 1 GB do plano gratuito da Aiven.
- **Variedade:** dados estruturados (CSV), semi-estruturados (XLSX com cabeçalho mesclado, metadados em JSON) e geoespaciais (vetor e raster).
- **Velocidade:** o Censo é decenal, então a carga é em lote e sob demanda. A carga é idempotente: recria o schema e recarrega tudo.
- **Veracidade:** sigilo estatístico tratado como nulo, checagens de consistência e linhagem por hash (ver "Tratamento").
- **Valor:** indicadores interseccionais de gênero × raça no território, que não aparecem nas tabelas municipais publicadas.

### LGPD

Os dados são agregados por setor censitário e não têm informação pessoal. O IBGE já aplica sigilo nas células com poucas pessoas, e o projeto não usa microdados. O uso de dados tornados públicos pelo poder público está previsto no art. 7º, §§ 3º e 4º, da LGPD.

## Tratamento

| Problema encontrado | Decisão | Justificativa |
|---|---|---|
| Arquivos nacionais grandes demais para o banco gratuito | Leitura em blocos (`chunksize`), filtro pelo prefixo `2927408` do código do setor e só as colunas necessárias | Cabe em 1 GB, e a filtragem fica reproduzível em código |
| Valores `X` (sigilo do IBGE): 80.856 células em Salvador | Viram `NULL`, nunca zero. Somas ignoram nulos, e `possui_sigilo` marca os totais afetados | Zero seria um dado falso; nulo deixa explícito que o valor existe mas não foi divulgado |
| Decimal com vírgula (`0,1456771`) | Troca por ponto e conversão para numérico | Tipagem correta no banco |
| Coluna-chave com nomes diferentes (`CD_SETOR`, `CD_setor`, `setor`) e variáveis em minúsculo (`v0001`) | Nomes normalizados para maiúsculo e chave renomeada para `cd_setor` | Junção entre fontes |
| Códigos numéricos longos | Mantidos como texto | Evita perder zeros à esquerda e notação científica |
| 224 variáveis de saneamento com nomes `Vxxxxx` | Classificação automática pela descrição do dicionário do IBGE (tema, categoria, sexo ou raça do responsável) | Evita digitar 224 códigos à mão e documenta a regra |
| Colunas largas (uma por sexo × raça) | Formato longo: setor × sexo × raça | Os filtros do painel viram um `WHERE` simples |
| CRS diferentes: setores em SIRGAS 2000, NDVI em UTM 24 | Tudo em EPSG:4674. O setor é reprojetado para o CRS do raster só no cálculo do NDVI | Evita reamostrar o raster |
| Geometria pesada para a web | Coluna extra `geom_web` em EPSG:4326, simplificada com tolerância de ~3 m | Mapa mais leve, sem alterar a geometria oficial |
| Planilhas XLSX com cabeçalho mesclado e erros (`#VALUE!`, `.`, `-`) | Grupo propagado entre colunas mescladas; erros viram `NULL`; só as linhas Brasil, Nordeste, Bahia e Salvador | Contexto comparativo sem copiar a planilha inteira |
| 38 setores aparecem só no arquivo básico (sem dados nos demais), 1 setor sem bairro | Mantidos na dimensão com indicadores nulos | Não some polígono do mapa |

Checagens registradas em `data/processed/relatorio_etl.json`:

- Cada tema de saneamento é uma partição dos domicílios, então o total por sexo do responsável precisa bater entre os temas. Ele varia de 949 mil a 955 mil, uma diferença de 0,6% causada pelo sigilo.
- A população somada por cor ou raça (2.408.480) fica 0,4% abaixo do total oficial por setor (2.417.678). Essa é a perda por sigilo.
- Nenhum setor das tabelas de fato ficou sem geometria.

## Modelagem

PostgreSQL com PostGIS, no schema `atlas`. É um modelo estrela com o setor censitário como grão.

```mermaid
erDiagram
  dim_bairro ||--o{ dim_setor : contem
  dim_fcu |o--o{ dim_setor : contem
  dim_setor ||--|| fato_setor : resume
  dim_setor ||--o{ fato_populacao : ""
  dim_setor ||--o{ fato_alfabetizacao : ""
  dim_setor ||--o{ fato_domicilio_resp : ""
  dim_sexo ||--o{ fato_populacao : ""
  dim_raca ||--o{ fato_populacao : ""
  dim_sexo ||--o{ fato_alfabetizacao : ""
  dim_raca ||--o{ fato_alfabetizacao : ""
  dim_sexo |o--o{ fato_domicilio_resp : ""
  dim_raca |o--o{ fato_domicilio_resp : ""
```

| Tabela | Linhas | Conteúdo |
|---|---:|---|
| `dim_setor` | 4.542 | código, bairro, subdistrito, FCU, `em_favela`, área, `geom` (4674), `geom_web` (4326) |
| `dim_bairro` | 170 | bairro com polígono dissolvido dos setores |
| `dim_fcu` | 262 | favela/comunidade urbana com polígono e área |
| `dim_sexo`, `dim_raca` | 2, 5 | `dim_raca.negra` marca preta e parda |
| `fato_setor` | 4.542 | população, domicílios, responsáveis por sexo, renda média e mediana, NDVI médio, % vegetação |
| `fato_populacao` | 45.040 | pessoas por setor × sexo × raça |
| `fato_alfabetizacao` | 45.040 | alfabetizados e não alfabetizados (15+) por setor × sexo × raça |
| `fato_domicilio_resp` | 157.640 | domicílios adequados e total por setor × tema × (sexo **ou** raça do responsável) |
| `ref_contexto` | 360 | tabelas XLSX em formato longo (tabela, recorte, grupo, categoria, valor, unidade) |
| `meta_fonte`, `meta_carga` | | linhagem das fontes e relatório de cada carga (`jsonb`) |
| `mv_somas_setor` | 4.542 | numeradores e denominadores de cada KPI por setor (base de todas as agregações) |
| `mv_kpi` | 4.977 | KPIs por setor, bairro, FCU, favela/não favela e cidade |
| `mv_saneamento` | 197.520 | % de domicílios adequados por tema e grupo, nos mesmos recortes |

Os tipos e restrições completos estão em `etl/sql/schema.sql`. Em `fato_domicilio_resp`, o IBGE publica saneamento por sexo **ou** por raça do responsável, sem cruzar os dois. Por isso a tabela tem as duas FKs e um `CHECK` exige que exatamente uma delas esteja preenchida.

**Por que relacional:** os dados têm estrutura fixa e relações claras (setor → bairro → FCU). O PostGIS resolve a parte espacial no mesmo banco. O pouco de dado semi-estruturado que existe (metadados, relatórios) vai em colunas `jsonb`, então um banco NoSQL separado não traria ganho.

### Regras de negócio (KPIs)

Todo KPI de um recorte maior que o setor é a **razão das somas**, nunca a média das taxas dos setores. As somas por setor ficam em `mv_somas_setor` (`etl/sql/views.sql`), e o painel agrega a partir dela para qualquer combinação de filtros.

| KPI | Regra |
|---|---|
| % população negra | (preta + parda) / total por cor ou raça |
| % domicílios chefiados por mulheres | responsáveis mulheres / (homens + mulheres) |
| Renda média e mediana do responsável | média ponderada pelo número de responsáveis (a mediana agregada é aproximação) |
| Gap de alfabetização | taxa de não alfabetizados (15+) das mulheres negras − a dos homens brancos, em p.p. |
| Gap de esgoto | % com esgoto por rede (geral, pluvial ou fossa ligada à rede) com responsável branco − com responsável negro, em p.p. |
| NDVI médio e % vegetação | média dos pixels de 30 m no setor; vegetação = NDVI ≥ 0,3; agregação ponderada pelo nº de pixels |

Primeiros resultados (`mv_kpi`):

| Recorte | População | % negra | % resp. mulher | Renda mediana | Analf. mulher negra | Analf. homem branco | NDVI |
|---|---:|---:|---:|---:|---:|---:|---:|
| Salvador | 2.408.480 | 83,3 | 55,8 | R$ 2.443 | 3,53% | 0,51% | 0,094 |
| Favelas | 1.031.892 | 91,7 | 56,7 | R$ 1.225 | 5,05% | 1,58% | 0,186 |
| Fora de favelas | 1.376.588 | 77,1 | 55,1 | R$ 3.332 | 2,24% | 0,25% | 0,085 |

## Painel (entrega 2)

App Next.js em `web/`. As páginas e a API ficam no mesmo projeto: as rotas em `web/app/api/*` rodam no servidor, consultam o PostgreSQL e devolvem JSON. O navegador nunca recebe a credencial do banco.

| Rota | O que devolve |
|---|---|
| `/api/geometria?nivel=` | polígonos de setores, bairros ou favelas (GeoJSON, cache de 1 dia) |
| `/api/mapa` | valor da métrica escolhida para cada unidade do mapa, com os filtros aplicados |
| `/api/resumo` | KPIs do recorte selecionado comparados com a cidade, as favelas e o resto da cidade |
| `/api/interseccional` | população e analfabetismo por sexo × raça no recorte |
| `/api/saneamento` | % de domicílios adequados no tema, por sexo e por raça do responsável |
| `/api/contexto?tabela=` | tabelas municipais do Censo (Salvador, Bahia, Nordeste, Brasil) |

Geometria e valores vêm em requisições separadas. A geometria é carregada uma vez por nível, e cada mudança de filtro só busca os números, que são poucos KB.

Interatividade:
- **Seletor de métrica:** 11 métricas, entre elas % população negra, chefia feminina, renda, analfabetismo, gaps, saneamento e NDVI.
- **Filtros cruzados:** território (cidade, favelas, fora de favelas), sexo e cor ou raça. Eles valem para o mapa, os KPIs, os gráficos e o ranking.
- **Drill-down:** bairro ou favela → setores → setor. A trilha no topo volta para os níveis anteriores, e o estado fica na URL, então dá para compartilhar um recorte.
- **Tooltips:** no mapa e nos gráficos. O ranking também funciona como tabela completa (visão acessível do mapa).
- Os filtros validam os parâmetros e montam as consultas sempre com parâmetros (`$1`, `$2`…), nunca concatenando texto do usuário.

Para rodar localmente:

```bash
cd web
echo "DATABASE_URL=postgresql://usuario:senha@localhost:5432/atlas" > .env.local
npm install
npm run dev
```

O painel abre em `http://localhost:3000`.

### Deploy no AWS Amplify

O `amplify.yml` na raiz já aponta para `web/` (`appRoot`). No console do Amplify:

1. Conecte o repositório do GitHub (branch `master`).
2. Em *Environment variables*, crie `DATABASE_URL` com a saída de `terraform -chdir=terraform output -raw app_database_url`. É o usuário só leitura.
3. Crie `PG_CA_CERT` com o certificado CA da Aiven (console → serviço → *Connection information* → *CA certificate*). Cole o conteúdo trocando as quebras de linha por `\n`.
4. Rode o deploy.

As variáveis do console do Amplify só existem durante o build. Por isso o `amplify.yml` grava `DATABASE_URL` e `PG_CA_CERT` num `.env.production` antes do `next build`, e é assim que as rotas `/api` enxergam essas variáveis em produção.

## Infraestrutura

| Serviço | Uso |
|---|---|
| Aiven for PostgreSQL 18 (plano free, 1 GB, DigitalOcean San Francisco `do-sfo`) | banco com PostGIS |
| Terraform + provider `aiven/aiven` 4.x | serviço PostgreSQL e usuário só leitura `atlas_app` |
| GitHub Actions | execução do ETL sob demanda |
| AWS Amplify | hospedagem do painel Next.js (entrega 2) |

O serviço PostgreSQL foi criado pelo console da Aiven e trazido para o Terraform com um bloco `import` (`terraform/main.tf`). A partir daí ele é gerenciado como código e tem `prevent_destroy`. O usuário `atlas_app` é criado pelo Terraform, e o ETL dá a ele só `SELECT` no schema `atlas`.

### Segurança

- Nenhuma credencial vai para o Git. `.env`, `terraform.tfvars` e o state do Terraform estão no `.gitignore`. O repositório tem só `.env.example` e `terraform.tfvars.example`.
- O token da Aiven entra pela variável de ambiente `TF_VAR_aiven_api_token`.
- No GitHub Actions, `DATABASE_URL` e `RAW_DATA_URL` são *Secrets* do repositório.
- O app usa o usuário só leitura, então mesmo com a credencial vazada ninguém altera os dados.
- A conexão com a Aiven exige SSL (`sslmode=require`).

## Execução

Requisitos: Python 3.10+, Terraform 1.6+ e um PostgreSQL com PostGIS (local ou Aiven).

1. Ambiente Python:

   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Configuração: `.env` com `DATABASE_URL`, `APP_DB_USER` e `TF_VAR_aiven_api_token`, no formato de `.env.example`, e `terraform/terraform.tfvars` no formato de `terraform/terraform.tfvars.example`.

3. Infraestrutura:

   ```bash
   set -a && source .env && set +a
   terraform -chdir=terraform init
   terraform -chdir=terraform apply
   terraform -chdir=terraform output -raw app_database_url
   ```

   O último comando mostra a URL do usuário `atlas_app`, usada no Amplify.

4. Arquivos locais em `data/raw/`. Os CSVs do IBGE são baixados pelo próprio ETL.

   | Pasta | Arquivos |
   |---|---|
   | `data/raw/geo/` | `SETORES_CENSITARIO_SALVADOR.*`, `qg_2022_670_fcu_agreg.*`, `NDVI.tif` |
   | `data/raw/tabelas/` | `Tabela_*.xlsx` |
   | `data/raw/ibge_setores/` | `Agregados_por_setores_renda_responsavel_BR.csv` |

5. ETL completo, ou só algumas etapas com `--etapas transform,load`:

   ```bash
   python etl/run.py
   ```

O ETL completo leva cerca de 1 minuto depois do download: 48 s de transformação e 11 s de carga. Ao final, `data/processed/relatorio_etl.json` mostra o que foi lido, filtrado, anulado e carregado, e uma cópia vai para `atlas.meta_carga`.

Saídas em `data/processed/`:
- `*.parquet`: uma tabela tratada por arquivo, igual ao que vai para o banco.
- `setores_salvador.gpkg`: setores com indicadores, para abrir no QGIS.
- `manifest_fontes.json` e `relatorio_etl.json`: linhagem e números do tratamento.
