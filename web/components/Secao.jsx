"use client";

import { useId, useState } from "react";
import Icone from "./Icone";

export default function Secao({ icone, titulo, aberta = true, children }) {
  const [aberto, setAberto] = useState(aberta);
  const id = useId();
  return (
    <section className={`secao${aberto ? " aberta" : ""}`}>
      <button type="button" className="secao-titulo" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-controls={id}>
        <Icone nome={icone} />
        <span>{titulo}</span>
        <span className="secao-seta">
          <Icone nome="seta" tamanho={16} />
        </span>
      </button>
      {aberto && (
        <div id={id} className="secao-corpo">
          {children}
        </div>
      )}
    </section>
  );
}
