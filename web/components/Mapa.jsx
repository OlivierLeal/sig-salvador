"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { corDe } from "@/lib/cores";
import { carregarGeometria as carregar } from "@/lib/geometria";
import { formatar } from "@/lib/metricas";

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
  ],
};

export default function Mapa(p) {
  const div = useRef(null);
  const mapa = useRef(null);
  const dados = useRef(null);
  const props = useRef(p);
  props.current = p;
  const [pronto, setPronto] = useState(false);
  const [geoVersao, setGeoVersao] = useState(0);
  const [dica, setDica] = useState(null);

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

    m.on("load", async () => {
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
      setPronto(true);
    });

    let hover;
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

  return (
    <div className="mapa">
      <div ref={div} className="mapa-canvas" role="region" aria-label={`Mapa: ${p.rotulo}`} />

      <div className="legenda-flutuante">{p.legenda}</div>

      {dica && (
        <div className="dica" style={{ left: dica.x + 14, top: dica.y + 14 }}>
          <strong>{dica.nome}</strong>
          <span>{dica.valor}</span>
        </div>
      )}
    </div>
  );
}
