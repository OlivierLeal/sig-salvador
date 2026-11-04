const cache = new Map();

export function carregarGeometria(nivel) {
  if (!cache.has(nivel)) {
    const p = fetch(`/api/geometria?nivel=${nivel}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(nivel));
    cache.set(nivel, p);
  }
  return cache.get(nivel);
}
