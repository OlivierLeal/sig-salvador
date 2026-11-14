# Atlas da Desigualdade de Salvador

Projeto prático de Big Data e Analytics (UCSal). Um SIG web que cruza raça, gênero, renda, saneamento, vegetação e temperatura da superfície nos 4.542 setores censitários de Salvador, comparando as Favelas e Comunidades Urbanas (FCUs) com o resto da cidade. Alinhado às ODS 5 (igualdade de gênero) e 18 (igualdade étnico-racial), com apoio das ODS 11 e 13 na parte ambiental.

**Pergunta:** os setores dentro de favelas concentram mais população negra, mais domicílios chefiados por mulheres, menos renda, pior saneamento, menos vegetação e mais calor? Dentro do mesmo território, a mulher negra está em desvantagem em relação ao homem branco?

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
  C["Landsat 8/9 de 2022<br/>(Planetary Computer)"] --> E
  D["Tabelas XLSX do Censo"] --> E
  E["ETL Python<br/>extract → transform → load"] --> P[("Aiven PostgreSQL + PostGIS")]
  T["Terraform"] -. provisiona .-> P
  P --> W["Next.js no AWS Amplify<br/>rotas /api + mapa"]
```

O ETL roda em lote, localmente ou pelo GitHub Actions (`.github/workflows/etl.yml`). O painel lê o banco por rotas de API no servidor, então a credencial nunca vai para o navegador.

## Dados utilizados

As fontes tabulares e as malhas são públicas, do IBGE (Censo Demográfico 2022). Temperatura e NDVI vêm das imagens Landsat 8 e 9 de 2022, o mesmo ano do Censo. O recorte é o município de Salvador (código `2927408`).

| Fonte | Tipo | Linhas lidas (Brasil) | Colunas no arquivo | Linhas Salvador | Colunas usadas |
|---|---|---:|---:|---:|---:|
| Agregados por setor: básico | CSV | 468.099 | 38 | 4.542 | 3 |
| Agregados por setor: demografia (sexo e faixa etária) | CSV | 458.772 | 37 | 4.504 | 24 |
| Agregados por setor: parentesco (chefia e composição do domicílio) | CSV | 458.772 | 183 | 4.504 | 12 |
| Agregados por setor: renda do responsável | CSV | 458.772 | 7 | 4.504 | 3 |
| Agregados por setor: cor ou raça | CSV | 458.772 | 96 | 4.504 | 10 |
| Agregados por setor: alfabetização | CSV | 458.772 | 363 | 4.504 | 20 |
| Agregados por setor: características do domicílio 2 | CSV | 458.772 | 407 | 4.504 | 224 |
| Agregados por setor: características do domicílio 1 (improvisados, cortiços, lotação) | CSV | 458.772 | 90 | 4.504 | 10 |
| Agregados por setor: características do domicílio 3 (saneamento por sexo dos moradores) | CSV | 458.772 | 149 | 4.504 | 64 |
| Agregados por setor: óbitos (jan/2019 a jul/2022) | CSV | 458.772 | 94 | 4.504 | 44 |
| Agregados por setor: pessoas quilombolas | CSV | 458.772 | 756 | 4.504 | 3 |
| Malha de setores censitários (Salvador) | Shapefile | 4.542 | | 4.542 | |
| Favelas e Comunidades Urbanas 2022 | Shapefile | 12.348 | | 262 | |
| Landsat 8/9 Collection 2 Level-2, 2022 (USGS, via Microsoft Planetary Computer) | COG, 30 m, WGS 84 / UTM 24N | 46 cenas | | 28 cenas | 4 bandas |
| Tabelas de resultados 01, 06, 08, 09, 11, 13, 14, 15, 16 | XLSX | | | 360 valores | |
| Dicionário dos agregados | XLSX | | | | |

**Landsat.** O módulo `etl/landsat.py` busca no catálogo STAC do Planetary Computer as cenas Landsat 8 e 9 de 2022 sobre Salvador com até 60% de nuvens. Ele lê só a janela do município das bandas vermelho, infravermelho próximo, térmica (`ST_B10`) e qualidade (`QA_PIXEL`), sem baixar a cena inteira. A temperatura vem pronta do produto Level-2 do USGS, com correção atmosférica e de emissividade: `°C = ST_B10 × 0,00341802 + 149,0 − 273,15`. O NDVI é `(NIR − Red) / (NIR + Red)` sobre a reflectância de superfície. A lista das cenas usadas fica em `data/raw/landsat/cenas_2022.json` e no manifesto.

O raster segue a convenção do Landsat de usar a zona UTM norte também no hemisfério sul, por isso o CRS é EPSG:32624 com coordenada Y negativa.

Limitações: a banda térmica tem resolução nativa de 100 m, entregue reamostrada em 30 m, então setores muito pequenos têm poucos pixels independentes de temperatura. A temperatura é da superfície (telhado, asfalto, solo), não do ar, e a composição é a mediana das passagens do satélite por volta das 9h40.

URL, tamanho e hash SHA-256 de cada arquivo ficam em `data/processed/manifest_fontes.json` e na tabela `atlas.meta_fonte`.

### Os 5 V's

- **Volume:** os CSVs nacionais somam cerca de 4,4 GB descompactados (só o de quilombolas tem 1,4 GB). O ETL lê em blocos de 50 mil linhas e guarda só Salvador, cerca de 1% das linhas e 417 das 2.220 colunas. O banco final ocupa 111 MB, dentro do limite de 1 GB do plano gratuito da Aiven.
- **Variedade:** dados estruturados (CSV), semi-estruturados (XLSX com cabeçalho mesclado, metadados em JSON) e geoespaciais (vetor, raster Landsat e superfície krigada).
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
| CRS diferentes: setores em SIRGAS 2000, Landsat em UTM 24N | Tudo em EPSG:4674. O setor é reprojetado para o CRS do raster só no cálculo por setor | Evita reamostrar o raster |
| Nuvens e sombras nas cenas Landsat | Máscara pixel a pixel pela banda `QA_PIXEL` (preenchimento, nuvem dilatada, cirros, nuvem e sombra) e mediana das cenas de 2022 | Uma cena isolada tem nuvem e é um dia só; a mediana do ano é mais estável |
| Cenas com nuvem não detectada pela máscara (uma delas com mediana de −5 °C) e cenas Tier 2 | Só cenas Tier 1; descarta a cena cuja mediana difere mais de 8 °C da mediana das cenas; o pixel precisa de 3 observações limpas | Evita que uma cena defeituosa ou um único dia defina o valor do pixel |
| Água (baía, lagoas, rios) puxava a temperatura e o NDVI dos setores para baixo; um setor de 386 km² quase todo baía tinha mais pixels que o resto da cidade | Pixel é água quando o bit 7 do `QA_PIXEL` aparece em mais da metade das observações limpas; água sai do raster | Temperatura da superfície da água não é exposição urbana |
| Falhas fixas em blocos na temperatura do USGS (lacunas do mapa de emissividade ASTER GED), iguais em todas as cenas | NDVI calculado sem depender da banda térmica; falhas em terra preenchidas por interpolação dos vizinhos até 600 m (78.535 de 755.636 pixels de terra, 10%) | Sem isso, 46 setores ficavam sem temperatura e a krigagem tinha buracos |
| Geometria pesada para a web | Coluna extra `geom_web` em EPSG:4326, simplificada com tolerância de ~3 m | Mapa mais leve, sem alterar a geometria oficial |
| Planilhas XLSX com cabeçalho mesclado e erros (`#VALUE!`, `.`, `-`) | Grupo propagado entre colunas mescladas; erros viram `NULL`; só as linhas Brasil, Nordeste, Bahia e Salvador | Contexto comparativo sem copiar a planilha inteira |
| Óbitos e quilombolas: o menor valor publicado é 3, então `X` vale 1 ou 2 | Nas taxas, `X` conta como 1,5 | Com `X` nulo, o gap de óbito por raça dava +1,5 p.p.; com 1,5, dá +0,2 |
| Setores com menos de 100 moradores ou só domicílio coletivo | Ficam fora das taxas de óbito e quilombolas (172 setores, 0,5% da população) | Neles o 1,5 gera taxas como 800‰ |
| Óbitos por ano com `X` em metade dos setores | Ficam em `fato_obito`, sem indicador | Não dá para comparar anos por setor |
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
| `fato_setor` | 4.542 | população, domicílios, responsáveis por sexo, renda média e mediana, NDVI médio, % vegetação, temperatura média da superfície, % em zona de calor, domicílios monoparentais por sexo, domicílios improvisados e precários, pessoas quilombolas, óbitos por sexo |
| `fato_populacao` | 45.040 | pessoas por setor × sexo × raça |
| `fato_alfabetizacao` | 45.040 | alfabetizados e não alfabetizados (15+) por setor × sexo × raça |
| `fato_domicilio_resp` | 157.640 | domicílios adequados e total por setor × tema × (sexo **ou** raça do responsável) |
| `fato_saneamento_pessoas` | 45.040 | moradores com serviço adequado e total por setor × tema × sexo do morador |
| `fato_idade` | 99.088 | pessoas por setor × sexo × faixa etária (11 faixas) |
| `fato_obito` | 144.128 | óbitos de moradores por setor × ano (2019 a jul/2022) × sexo × faixa etária |
| `fato_obito_resp` | 22.520 | domicílios com e sem óbito por setor × cor ou raça do responsável |
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
| Temperatura da superfície | média dos pixels de 30 m no setor (°C); agregação ponderada pelo nº de pixels |
| % em zona de calor | pixels com temperatura ≥ média de Salvador + 1 desvio padrão (39,0 °C); agregação ponderada pelo nº de pixels |
| Exposição ao calor | temperatura média dos setores ponderada pela população do grupo (sexo e raça escolhidos no filtro) |
| Gap de calor | exposição da população negra − exposição da população branca, em °C |
| % mãe solo | domicílios com responsável mulher, sem cônjuge, com filhos ou enteados / total de domicílios |
| % idosos e % mulheres entre os idosos | pessoas 60+ / total; mulheres 60+ / pessoas 60+ |
| % quilombola | pessoas quilombolas / população |
| Óbitos por mil por ano | óbitos de jan/2019 a jul/2022, anualizados / população (taxa bruta) |
| % domicílios com óbito | domicílios que perderam um morador / total, por raça do responsável |
| Gap de óbito | % de domicílios com óbito com responsável negro − com responsável branco, em p.p. |

Primeiros resultados (`mv_kpi`):

| Recorte | População | % negra | % resp. mulher | Renda mediana | Analf. mulher negra | Analf. homem branco | NDVI |
|---|---:|---:|---:|---:|---:|---:|---:|
| Salvador | 2.408.480 | 83,3 | 55,8 | R$ 2.443 | 3,53% | 0,51% | 0,51 |
| Favelas | 1.031.892 | 91,7 | 56,7 | R$ 1.225 | 5,05% | 1,58% | 0,43 |
| Fora de favelas | 1.376.588 | 77,1 | 55,1 | R$ 3.332 | 2,24% | 0,25% | 0,54 |

| Recorte | Temperatura da superfície | % em zona de calor | Exposição ao calor | Gap de calor (negra − branca) |
|---|---:|---:|---:|---:|
| Salvador | 35,1 °C | 17,4% | 37,3 °C | +0,65 °C |
| Favelas | 36,6 °C | 21,6% | 37,8 °C | +0,03 °C |
| Fora de favelas | 34,7 °C | 16,3% | 36,9 °C | +0,55 °C |

As favelas são 1,9 °C mais quentes, têm menos vegetação e mais área em zona de calor. Na cidade, a população negra mora em setores 0,65 °C mais quentes que a branca. Dentro das favelas a diferença some, porque elas já são homogeneamente negras e quentes: a desigualdade de calor é entre territórios.

### Família, idade, quilombolas e óbitos

| Recorte | % mãe solo | % mulheres entre mães/pais solo | % idosos | % mulheres entre idosos | Quilombolas | Óbitos/mil/ano | % dom. com óbito (resp. negro) | (resp. branco) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Salvador | 18,3 | 89,1 | 16,5 | 60,4 | 16.026 (0,66%) | 5,4 | 4,90 | 4,71 |
| Favelas | 20,4 | 88,9 | 13,3 | 59,6 | 10.185 (0,99%) | 5,5 | 4,96 | 5,74 |
| Fora de favelas | 16,8 | 89,3 | 19,0 | 60,8 | 5.841 (0,42%) | 5,3 | 4,87 | 4,52 |

Em favela, um em cada cinco domicílios é de mãe solo, e 89% das famílias monoparentais são chefiadas por mulheres. Os quilombolas estão na Ilha de Maré e em São Tomé de Paripe. A diferença de óbito por raça é pequena; dentro das favelas há poucos domicílios brancos e o número oscila com o sigilo. As favelas são mais jovens, então a mesma taxa bruta de óbito ali indica mortalidade maior.

Saneamento por sexo do morador e moradia improvisada ficaram só no banco: o primeiro quase não varia entre homens e mulheres, e o segundo é 0,2% dos domicílios.

## Painel (entrega 2)

App Next.js em JavaScript (React, sem TypeScript) em `web/`. As páginas e a API ficam no mesmo projeto: as rotas em `web/app/api/*` rodam no servidor, consultam o PostgreSQL e devolvem JSON. O navegador nunca recebe a credencial do banco.

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
- **Seletor de métrica:** 22 métricas, entre elas % população negra, chefia feminina, mãe solo, idosos, quilombolas, renda, analfabetismo, gaps, saneamento, óbitos, NDVI, temperatura, zona de calor e exposição ao calor.
- **Mapa base:** ortofoto 2017 de Salvador com 10 cm de resolução (WMS da CONDER) como padrão, com opções de ruas, satélite ou sem fundo. O crédito da base aparece no rodapé do mapa.
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

### Krigagem da renda

`etl/krigagem.R` (R + `gstat`, `sf`, `terra`) gera uma superfície contínua da renda média do responsável (`V06004`) a partir dos setores. O ETL chama o script na etapa `krigagem`.

| Decisão | Justificativa |
|---|---|
| Um ponto por setor (`st_point_on_surface`), em SIRGAS 2000 / UTM 24S | O ponto fica sempre dentro do polígono, e a distância é em metros |
| Krigagem do log da renda, volta para R$ com `exp(z + σ²/2)` | Renda é muito assimétrica; o log estabiliza a variância e a correção evita subestimar |
| Krigagem ordinária com os 32 setores mais próximos | Vizinhança local; o variograma sobe sem patamar além de ~5 km (tendência orla × subúrbio), e a vizinhança limita esse efeito |
| Exponencial, esférico e gaussiano comparados por validação cruzada em 10 dobras | Escolha pelo menor erro, não pelo ajuste visual |
| Grade de 100 m, máscara = setores do município menos a água do Landsat | Superfície contínua em terra, sem prever renda sobre a baía e as lagoas |

Resultado (`data/processed/krigagem_renda.json`): modelo exponencial, pepita 0,08, patamar parcial 0,41, alcance prático de 4,6 km. Na validação cruzada, erro médio absoluto de R$ 891 por setor e z-score com média 0,00 e desvio 0,93, ou seja, a variância estimada é realista. Saídas: `krigagem_renda_media.tif`, `krigagem_renda_variancia_log.tif` e `variograma_renda.png`.

![Variograma](data/processed/variograma_renda.png)

Limitações: o setor é tratado como ponto (krigagem de área para ponto seria mais rigorosa), e em áreas sem moradores, como parques e o aeroporto, o valor é interpolado dos vizinhos, não observado.

### Temperatura no SIG

A temperatura entra no painel de quatro formas, e todas respondem aos filtros:

1. **Camadas raster.** No painel de camadas, "Temperatura da superfície (Landsat 2022)" sobrepõe o mapa de calor em 30 m e "Renda média do responsável (krigagem)" sobrepõe a superfície krigada. O ETL gera as imagens e o índice `camadas.json` em `web/public/camadas/`.
2. **Indicadores do mapa.** Temperatura da superfície e % em zona de calor por setor, bairro ou favela, com escala de cores quente.
3. **Exposição por grupo.** "Temperatura a que a população está exposta" usa os filtros de sexo e raça: é a temperatura dos setores ponderada pela população do grupo. O gap de calor compara a população negra com a branca.
4. **Gráfico de raça × sexo.** O gráfico das análises alterna entre analfabetismo e temperatura. Na temperatura, mostra quanto cada grupo mora acima ou abaixo da média do recorte.

A ligação com as ODS 5 e 18 vem desse cruzamento: o calor é um risco ambiental, e a pergunta é se ele se concentra onde mora a população negra e onde as mulheres chefiam os domicílios (racismo ambiental). A exposição é medida por território, não por pessoa, porque o Censo não informa quanto tempo cada grupo passa em casa.

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

Requisitos: Python 3.10+, R 4.1+ com os pacotes `gstat`, `sf`, `terra` e `jsonlite`, Terraform 1.6+ e um PostgreSQL com PostGIS (local ou Aiven).

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

4. Arquivos locais em `data/raw/`. Os CSVs do IBGE e as cenas Landsat (`data/raw/landsat/`) são baixados pelo próprio ETL.

   | Pasta | Arquivos |
   |---|---|
   | `data/raw/geo/` | `SETORES_CENSITARIO_SALVADOR.*`, `qg_2022_670_fcu_agreg.*` |
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
