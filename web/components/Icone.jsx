const CAMINHOS = {
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  enquadrar: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  globo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z" />
    </>
  ),
  contorno: <path d="M5 7l5-3 6 2 3 5-2 6-6 3-5-3-2-5z" strokeDasharray="2.4 2" />,
  camadas: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />,
  casa: <path d="M4 11l8-7 8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" />,
  busca: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  seta: <path d="M6 9l6 6 6-6" />,
  indicador: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  filtro: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  alvo: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  grafico: <path d="M4 4v16h16M8 16l4-5 3 3 5-7" />,
  tabela: <path d="M3 5h18v14H3zM3 10h18M3 14.5h18M9 5v14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
  recolher: <path d="M15 6l-6 6 6 6" />,
};

export default function Icone({ nome, tamanho = 18 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CAMINHOS[nome]}
    </svg>
  );
}
