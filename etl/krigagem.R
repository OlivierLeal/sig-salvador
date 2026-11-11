suppressPackageStartupMessages({
  library(sf)
  library(gstat)
  library(terra)
  library(jsonlite)
})

arg <- commandArgs(trailingOnly = TRUE)
raiz <- if (length(arg)) arg[1] else getwd()
processado <- file.path(raiz, "data", "processed")
arq_ndvi <- file.path(raiz, "data", "raw", "landsat", "ndvi_2022.tif")

crs_metrico <- 31984
res <- 100
vizinhos <- 32
modelos <- c(Exp = "exponencial", Sph = "esférico", Gau = "gaussiano")

setores <- st_read(file.path(processado, "setores_salvador.gpkg"), layer = "setores", quiet = TRUE)
setores <- st_make_valid(st_transform(setores, crs_metrico))

pts <- setores[!is.na(setores$renda_media) & setores$renda_media > 0, c("cd_setor", "renda_media")]
pts <- suppressWarnings(st_point_on_surface(pts))
pts$z <- log(pts$renda_media)

v <- variogram(z ~ 1, pts, cutoff = 15000, width = 500)

ajustes <- lapply(names(modelos), function(m) {
  inicial <- vgm(psill = var(pts$z) * 0.7, model = m, range = 3000, nugget = var(pts$z) * 0.3)
  suppressWarnings(fit.variogram(v, inicial))
})
names(ajustes) <- names(modelos)

set.seed(2022)
dobras <- sample(rep_len(1:10, nrow(pts)))
validacao <- lapply(names(ajustes), function(m) {
  cv <- krige.cv(z ~ 1, pts, model = ajustes[[m]], nmax = vizinhos, nfold = dobras, verbose = FALSE)
  real <- exp(cv$observed)
  prev <- exp(cv$var1.pred + cv$var1.var / 2)
  list(
    modelo = modelos[[m]],
    rmse_log = round(sqrt(mean(cv$residual^2)), 4),
    rmse_reais = round(sqrt(mean((prev - real)^2)), 2),
    mae_reais = round(mean(abs(prev - real)), 2),
    zscore_medio = round(mean(cv$zscore), 4),
    zscore_desvio = round(sd(cv$zscore), 4)
  )
})
melhor <- names(ajustes)[which.min(sapply(validacao, `[[`, "rmse_log"))]
modelo <- ajustes[[melhor]]

grade <- rast(ext(vect(setores)), resolution = res, crs = paste0("EPSG:", crs_metrico))
terra_firme <- rasterize(vect(setores), grade)
agua_30m <- project(is.na(rast(arq_ndvi)), crs(grade), method = "near")
agua <- resample(agua_30m, grade, method = "average") > 0.5
terra_firme[agua] <- NA

celulas <- which(!is.na(values(terra_firme)))
xy <- xyFromCell(grade, celulas)
alvo <- st_as_sf(data.frame(xy), coords = c("x", "y"), crs = crs_metrico)
k <- krige(z ~ 1, pts, alvo, model = modelo, nmax = vizinhos, debug.level = 0)

renda <- grade
variancia <- grade
values(renda) <- NA
values(variancia) <- NA
renda[celulas] <- exp(k$var1.pred + k$var1.var / 2)
variancia[celulas] <- k$var1.var

writeRaster(renda, file.path(processado, "krigagem_renda_media.tif"), overwrite = TRUE,
            datatype = "FLT4S", gdal = "COMPRESS=DEFLATE")
writeRaster(variancia, file.path(processado, "krigagem_renda_variancia_log.tif"), overwrite = TRUE,
            datatype = "FLT4S", gdal = "COMPRESS=DEFLATE")

png(file.path(processado, "variograma_renda.png"), width = 1400, height = 900, res = 160)
print(plot(v, modelo, pch = 16, col = "#2a78d6", lwd = 2,
           main = sprintf("Variograma do log da renda média do responsável (%s)", modelos[[melhor]]),
           xlab = "distância (m)", ylab = "semivariância"))
invisible(dev.off())

param <- modelo[modelo$model != "Nug", ]
write_json(list(
  ferramenta = paste("R", getRversion(), "gstat", as.character(packageVersion("gstat"))),
  variavel = "renda_media (V06004), em log",
  pontos = nrow(pts),
  ponto_do_setor = "st_point_on_surface",
  crs = paste0("EPSG:", crs_metrico),
  resolucao_m = res,
  vizinhos = vizinhos,
  mascara = "setores do município menos pixels de água do Landsat",
  modelo = modelos[[melhor]],
  parametros = list(
    pepita = round(sum(modelo$psill[modelo$model == "Nug"]), 4),
    patamar_parcial = round(param$psill, 4),
    alcance_m = round(param$range, 1),
    alcance_pratico_m = round(param$range * c(Exp = 3, Sph = 1, Gau = sqrt(3))[[melhor]], 1)
  ),
  validacao_cruzada_10_dobras = validacao,
  renda_estimada_min_max = round(as.numeric(global(renda, range, na.rm = TRUE)), 2),
  saidas = c("krigagem_renda_media.tif", "krigagem_renda_variancia_log.tif", "variograma_renda.png")
), file.path(processado, "krigagem_renda.json"), auto_unbox = TRUE, pretty = TRUE)

cat(sprintf("  %d setores, variograma %s\n", nrow(pts), modelos[[melhor]]))
