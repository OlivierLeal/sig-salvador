"use client";

import { useEffect, useState } from "react";

export function useApi(caminho) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!caminho) return;
    const ctrl = new AbortController();
    setCarregando(true);
    setErro(null);
    fetch(caminho, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setDados(d))
      .catch((e) => {
        if (e.name !== "AbortError") setErro("Não foi possível carregar os dados. Tente de novo em instantes.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setCarregando(false);
      });
    return () => ctrl.abort();
  }, [caminho]);

  return { dados, carregando, erro };
}
