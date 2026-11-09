"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { corDe } from "@/lib/cores";
import { carregarGeometria as carregar } from "@/lib/geometria";
import { formatar } from "@/lib/metricas";
import Icone from "./Icone";

const SALVADOR = [
  [-38.56, -13.02],
  [-38.3, -12.73],
];

const ESTILO = {
  version: 8,
  sources: {
    ruas: {
      type: "raster",
      tileSize: 256,
      maxzoom: 16,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Mapa base © Esri, HERE, Garmin, OpenStreetMap",
    },
    ortofoto: {
      type: "raster",
      tileSize: 256,
      minzoom: 10,
      maxzoom: 20,
      bounds: [-38.661912, -13.019282, -38.291641, -12.739442],
      tiles: [
        "https://mapas.conder.ba.gov.br/arcgis/services/MOSAICO/Salvador_2017_10cm/ImageServer/WMSServer" +
          "?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=Salvador_2017_10cm&STYLES=&FORMAT=image/png" +
          "&TRANSPARENT=true&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256",
      ],
      attribution: "Ortofoto 2017 (10 cm) © CONDER",
    },
    satelite: {
      type: "raster",
      tileSize: 256,
      maxzoom: 18,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
    },
    rotulos: {
      type: "raster",
      tileSize: 256,
      maxzoom: 16,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
    },
  },
  layers: [
    { id: "fundo", type: "background", paint: { "background-color": "#f1f2f4" } },
    { id: "ruas", type: "raster", source: "ruas" },
    { id: "satelite", type: "raster", source: "satelite", layout: { visibility: "none" } },
    { id: "ortofoto", type: "raster", source: "ortofoto" },
  ],
};

function limites(features) {
  const b = new maplibregl.LngLatBounds();
  let algum = false;
  const visitar = (c) => {
    if (typeof c[0] === "number") {
      b.extend(c);
      algum = true;
    } else c.forEach(visitar);
  };
  features.forEach((f) => visitar(f.geometry.coordinates));
  return algum ? b : null;
}

function escala(m) {
  const lat = m.getCenter().lat;
  const metrosPorPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** m.getZoom();
  const n = metrosPorPixel * (96 / 0.0254);
  const arred = n > 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100;
  return arred.toLocaleString("pt-BR");
}

export default function Mapa(p) {
  const div = useRef(null);
  const mapa = useRef(null);
  const dados = useRef(null);
  const props = useRef(p);
  props.current = p;
  const [pronto, setPronto] = useState(false);
  const [geoVersao, setGeoVersao] = useState(0);
  const [dica, setDica] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [esc, setEsc] = useState("");
  const [camadas, setCamadas] = useState(false);
  const [fundo, setFundo] = useState("ortofoto");
  const [rotulos, setRotulos] = useState(true);
  const [favelas, setFavelas] = useState(true);
  const [opacidade, setOpacidade] = useState(65);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: div.current,
      style: ESTILO,
      bounds: SALVADOR,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapa.current = m;
    const atualizarEscala = () => setEsc(escala(m));
    m.on("move", atualizarEscala);

    m.on("load", async () => {
      atualizarEscala();
      m.addSource("unidades", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "codigo" });
      m.addLayer({
        id: "unid-fill",
        type: "fill",
        source: "unidades",
        paint: {
          "fill-color": ["coalesce", ["feature-state", "cor"], "#b9bdc6"],
          "fill-opacity": ["case", ["==", ["feature-state", "cor"], null], 0.12, 0.8],
        },
      });
      m.addLayer({
        id: "unid-borda",
        type: "line",
        source: "unidades",
        paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.25, 15, 1] },
      });
      m.addLayer({ id: "rotulos", type: "raster", source: "rotulos" });

      const fcu = await carregar("fcu");
      m.addSource("favelas", { type: "geojson", data: fcu });
      m.addLayer({
        id: "favelas-linha",
        type: "line",
        source: "favelas",
        paint: { "line-color": "#14285a", "line-width": 1.2, "line-dasharray": [2, 1.5], "line-opacity": 0.75 },
      });
      m.addLayer({
        id: "unid-hover",
        type: "line",
        source: "unidades",
        paint: { "line-color": "#14285a", "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 0] },
      });
      m.addLayer({
        id: "unid-sel",
        type: "line",
        source: "unidades",
        filter: ["==", ["get", "codigo"], ""],
        paint: { "line-color": "#eb6834", "line-width": 3 },
      });
      setPronto(true);
    });

    let hover;
    m.on("mousemove", (e) => setCursor([e.lngLat.lng, e.lngLat.lat]));
    m.on("mouseout", () => setCursor(null));
    m.on("mousemove", "unid-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (hover !== undefined) m.setFeatureState({ source: "unidades", id: hover }, { hover: false });
      hover = f.id;
      m.setFeatureState({ source: "unidades", id: hover }, { hover: true });
      m.getCanvas().style.cursor = "pointer";
      setDica({
        x: e.point.x,
        y: e.point.y,
        nome: String(f.properties.nome),
        valor: formatar(f.state?.valor ?? null, props.current.unidade),
      });
    });
    m.on("mouseleave", "unid-fill", () => {
      if (hover !== undefined) m.setFeatureState({ source: "unidades", id: hover }, { hover: false });
      hover = undefined;
      m.getCanvas().style.cursor = "";
      setDica(null);
    });
    m.on("click", "unid-fill", (e) => {
      const f = e.features?.[0];
      if (f) props.current.onSelecionar(f.properties);
    });

    const obs = new ResizeObserver(() => m.resize());
    obs.observe(div.current);
    return () => {
      obs.disconnect();
      m.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pronto) return;
    let vivo = true;
    carregar(p.nivel).then((fc) => {
      if (!vivo || !mapa.current) return;
      dados.current = fc;
      mapa.current.getSource("unidades").setData(fc);
      setGeoVersao((v) => v + 1);
    });
    return () => {
      vivo = false;
    };
  }, [pronto, p.nivel]);

  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m || !dados.current) return;
    m.removeFeatureState({ source: "unidades" });
    for (const f of dados.current.features) {
      const id = f.properties.codigo;
      const valor = p.valores.has(id) ? p.valores.get(id) : null;
      m.setFeatureState({ source: "unidades", id }, { valor, cor: corDe(valor, p.classes) });
    }
  }, [pronto, geoVersao, p.valores, p.classes]);

  useEffect(() => {
    if (pronto) mapa.current?.setFilter("unid-sel", ["==", ["get", "codigo"], p.setor]);
  }, [pronto, p.setor]);

  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m) return;
    const imagem = fundo === "ortofoto" || fundo === "satelite";
    m.setLayoutProperty("ruas", "visibility", fundo === "ruas" || fundo === "ortofoto" ? "visible" : "none");
    m.setLayoutProperty("satelite", "visibility", fundo === "satelite" ? "visible" : "none");
    m.setLayoutProperty("ortofoto", "visibility", fundo === "ortofoto" ? "visible" : "none");
    m.setLayoutProperty("rotulos", "visibility", rotulos ? "visible" : "none");
    m.setLayoutProperty("favelas-linha", "visibility", favelas ? "visible" : "none");
    m.setPaintProperty("favelas-linha", "line-color", imagem ? "#ffffff" : "#14285a");
    m.setPaintProperty("unid-fill", "fill-opacity", ["case", ["==", ["feature-state", "cor"], null], 0.12, opacidade / 100]);
  }, [pronto, fundo, rotulos, favelas, opacidade]);

  const enquadrar = () => {
    const m = mapa.current;
    if (!m || !dados.current) return;
    const { bairro, fcu } = props.current.foco;
    const alvo = dados.current.features.filter(
      (f) => (bairro && f.properties.cd_bairro === bairro) || (fcu && f.properties.cd_fcu === fcu),
    );
    const b = alvo.length ? limites(alvo) : SALVADOR;
    if (b) m.fitBounds(b, { padding: 48, maxZoom: 15, duration: 600 });
  };

  useEffect(() => {
    if (pronto) enquadrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, geoVersao, p.foco.bairro, p.foco.fcu]);

  const zoom = (d) => mapa.current?.easeTo({ zoom: mapa.current.getZoom() + d, duration: 250 });

  return (
    <div className="mapa">
      <div ref={div} className="mapa-canvas" role="region" aria-label={`Mapa: ${p.rotulo}`} />

      <div className="ferramentas" role="toolbar" aria-label="Ferramentas do mapa">
        <button type="button" onClick={() => zoom(1)} title="Aproximar" aria-label="Aproximar">
          <Icone nome="mais" />
        </button>
        <button type="button" onClick={() => zoom(-1)} title="Afastar" aria-label="Afastar">
          <Icone nome="menos" />
        </button>
        <button type="button" onClick={enquadrar} title="Enquadrar o recorte" aria-label="Enquadrar o recorte">
          <Icone nome="enquadrar" />
        </button>
        <button
          type="button"
          onClick={() => setFundo(fundo === "ortofoto" ? "ruas" : "ortofoto")}
          title={fundo === "ortofoto" ? "Mapa de ruas" : "Ortofoto 2017"}
          aria-label="Alternar ortofoto"
          aria-pressed={fundo === "ortofoto"}
        >
          <Icone nome="globo" />
        </button>
        <button
          type="button"
          onClick={() => setFavelas(!favelas)}
          title="Contorno das favelas"
          aria-label="Contorno das favelas"
          aria-pressed={favelas}
        >
          <Icone nome="contorno" />
        </button>
      </div>

      <div className="camadas">
        <button
          type="button"
          className="camadas-botao"
          onClick={() => setCamadas(!camadas)}
          aria-expanded={camadas}
          title="Camadas"
          aria-label="Camadas"
        >
          <Icone nome="camadas" />
        </button>
        {camadas && (
          <div className="camadas-painel">
            <p className="camadas-titulo">Mapa de fundo</p>
            {[
              ["ortofoto", "Ortofoto 2017 (CONDER, 10 cm)"],
              ["ruas", "Ruas"],
              ["satelite", "Satélite (Esri)"],
              ["nenhum", "Sem fundo"],
            ].map(([k, v]) => (
              <label key={k} className="opcao">
                <input type="radio" name="fundo" id={`fundo-${k}`} checked={fundo === k} onChange={() => setFundo(k)} />
                {v}
              </label>
            ))}
            <p className="camadas-titulo">Sobreposições</p>
            <label className="opcao">
              <input type="checkbox" id="cam-favelas" checked={favelas} onChange={(e) => setFavelas(e.target.checked)} />
              Contorno das favelas (IBGE)
            </label>
            <label className="opcao">
              <input type="checkbox" id="cam-rotulos" checked={rotulos} onChange={(e) => setRotulos(e.target.checked)} />
              Nomes de lugares
            </label>
            <label className="opcao coluna" htmlFor="cam-opacidade">
              <span>Opacidade do indicador: {opacidade}%</span>
              <input
                type="range"
                id="cam-opacidade"
                min={20}
                max={100}
                step={5}
                value={opacidade}
                onChange={(e) => setOpacidade(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>

      <div className="legenda-flutuante">{p.legenda}</div>

      {dica && (
        <div className="dica" style={{ left: dica.x + 14, top: dica.y + 14 }}>
          <strong>{dica.nome}</strong>
          <span>{dica.valor}</span>
        </div>
      )}

      <footer className="status">
        <span>
          Projeção <b>SIRGAS 2000 (EPSG:4674)</b>
        </span>
        <span className="status-fonte">
          {
            {
              ortofoto: "Base: Ortofoto 2017 © CONDER",
              ruas: "Base: © Esri, OpenStreetMap",
              satelite: "Base: © Esri, Maxar",
              nenhum: "",
            }[fundo]
          }
        </span>
        <span className="status-coord">
          {cursor ? `${cursor[1].toFixed(5)}, ${cursor[0].toFixed(5)}` : "Passe o cursor no mapa"}
        </span>
        <span>
          Escala <b>1 : {esc}</b>
        </span>
      </footer>
    </div>
  );
}
