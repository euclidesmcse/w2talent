/**
 * 2.6a: desenha um artigo de ajuda já lido por lerMarkdown (lib/ajuda.ts).
 * Sem dangerouslySetInnerHTML: cada bloco vira o elemento certo e links só levam a caminhos do site.
 */
import * as React from "react";
import Link from "next/link";
import { lerMarkdown, type Trecho } from "@/lib/ajuda";

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((x, i) =>
        x.t === "b" ? <strong key={i} className="font-semibold text-ink">{x.v}</strong>
        : x.t === "code" ? <code key={i} className="rounded bg-canvas px-1 font-mono text-[0.92em]">{x.v}</code>
        : x.t === "a" ? <Link key={i} href={x.href} className="font-medium text-brand underline underline-offset-2">{x.v}</Link>
        : <React.Fragment key={i}>{x.v}</React.Fragment>,
      )}
    </>
  );
}

export function AjudaArtigo({ corpo }: { corpo: string }) {
  const blocos = lerMarkdown(corpo);
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink" data-ajuda-corpo>
      {blocos.map((b, i) => {
        switch (b.t) {
          case "h2":
            return <h2 key={i} className="mt-4 text-xl font-semibold">{b.texto}</h2>;
          case "p":
            return <p key={i}><Trechos trechos={b.trechos} /></p>;
          case "ul":
            return <ul key={i} className="list-disc space-y-1.5 pl-5">{b.itens.map((it, j) => <li key={j}><Trechos trechos={it} /></li>)}</ul>;
          case "ol":
            return <ol key={i} className="list-decimal space-y-1.5 pl-5">{b.itens.map((it, j) => <li key={j}><Trechos trechos={it} /></li>)}</ol>;
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full border-collapse text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left">
                      {b.cabeca.map((c, j) => <th key={j} scope="col" className="px-4 py-2 font-medium text-muted"><Trechos trechos={c} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {b.linhas.map((l, j) => (
                      <tr key={j} className="border-b border-line-soft last:border-0">
                        {l.map((c, k) => <td key={k} className="px-4 py-2"><Trechos trechos={c} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
