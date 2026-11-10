"use client";
import * as React from "react";
import qrcode from "qrcode-generator";

/** QR em SVG (1.5.5, autenticador). Desenhado aqui, sem chamar nenhum site: o segredo não sai do navegador. */
export function QrCode({ texto, rotulo, tamanho = 200 }: { texto: string; rotulo: string; tamanho?: number }) {
  const { n, d } = React.useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { n, d };
  }, [texto]);
  return (
    <svg role="img" aria-label={rotulo} width={tamanho} height={tamanho} viewBox={`0 0 ${n + 8} ${n + 8}`} shapeRendering="crispEdges" className="rounded-control border border-line bg-white">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
