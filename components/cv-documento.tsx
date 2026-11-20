"use client";
/**
 * CV por vaga (plano 2026-11-20 "CV por vaga", D4): o documento em uma coluna e o botão que abre a
 * impressão do navegador ("Salvar como PDF"). Sem biblioteca de PDF: o Worker não carrega nada a mais.
 * A versão do candidato leva os contatos dele; a da empresa (/rh) não leva. Nunca foto, endereço ou nascimento.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui";
import { periodoCargo } from "@/lib/coach-rascunho";
import type { CvVaga } from "@/lib/coach-vaga";

export type ContatoCv = { email?: string; celular?: string; localidade?: string };

type DocProps = { cv: CvVaga; nome: string; contato?: ContatoCv | null; resumo?: string; porQue?: string };

/** Cores fixas: o PDF sai igual no tema claro e no escuro. */
const TINTA = "#111827";
const SUAVE = "#4B5563";

export function CvDocumento({ cv, nome, contato, resumo, porQue }: DocProps) {
  const t = useTranslations("cvDoc");
  const tf = useTranslations("ficha");
  const locale = useLocale();
  const linhaContato = [contato?.email, contato?.celular, contato?.localidade].filter(Boolean).join(" · ");
  const titulo = (s: string) => (
    <h2 style={{ color: SUAVE, borderBottom: "1px solid #D1D5DB" }} className="mt-5 pb-1 text-[11pt] font-semibold uppercase">
      {s}
    </h2>
  );
  return (
    <article lang={locale} style={{ color: TINTA, background: "#FFFFFF" }} className="mx-auto max-w-[180mm] font-sans text-[10.5pt] leading-snug">
      <header>
        <p className="text-[18pt] font-semibold">{nome}</p>
        {cv.titulo ? <p className="text-[12pt]">{cv.titulo}</p> : null}
        {linhaContato ? <p style={{ color: SUAVE }} className="mt-1">{linhaContato}</p> : null}
      </header>
      {porQue ? (
        <>
          {titulo(t("porQue"))}
          <p className="mt-2">{porQue}</p>
        </>
      ) : null}
      {resumo ? (
        <>
          {titulo(t("resumo"))}
          <p className="mt-2">{resumo}</p>
        </>
      ) : null}
      {cv.cargos.length ? (
        <>
          {titulo(t("experiencia"))}
          {cv.cargos.map((c) => (
            <section key={c.i} className="mt-3" style={{ breakInside: "avoid" }}>
              <p className="font-semibold">
                {c.cargo}
                {c.empresa ? <span className="font-normal"> · {c.empresa}</span> : null}
              </p>
              <p style={{ color: SUAVE }} className="text-[9.5pt]">{periodoCargo(c, locale)}</p>
              {c.pontos.length ? (
                <ul className="mt-1 list-disc pl-5">
                  {c.pontos.map((p, k) => (
                    <li key={k}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </>
      ) : null}
      {cv.competencias.length ? (
        <>
          {titulo(t("competencias"))}
          <p className="mt-2">{cv.competencias.map((c) => (c.anos > 0 ? `${c.nome} (${t("anos", { n: c.anos })})` : c.nome)).join(" · ")}</p>
        </>
      ) : null}
      {cv.formacao.length ? (
        <>
          {titulo(t("formacao"))}
          <ul className="mt-2">
            {cv.formacao.map((f, k) => (
              <li key={k}>{[f.curso, f.instituicao, f.ano].filter(Boolean).join(" · ")}</li>
            ))}
          </ul>
        </>
      ) : null}
      {cv.idiomas.length ? (
        <>
          {titulo(t("idiomas"))}
          <p className="mt-2">{cv.idiomas.map((i) => (i.nivel ? `${i.idioma} (${tf(`niv_${i.nivel}` as "niv_basico")})` : i.idioma)).join(" · ")}</p>
        </>
      ) : null}
    </article>
  );
}

/**
 * Botão "Baixar PDF": monta o documento direto no <body> e chama a impressão do navegador.
 * O CSS global (`body.imprimindo-cv`) esconde o resto da página só durante essa impressão.
 */
export function BotaoPdf({
  label,
  arquivo,
  documento,
  variant = "secondary",
}: {
  label: string;
  arquivo: string;
  /** O documento, ou uma função que o monta (por exemplo, depois de buscar os contatos). */
  documento: React.ReactNode | (() => Promise<React.ReactNode>);
  variant?: "secondary" | "ghost";
}) {
  const [doc, setDoc] = React.useState<React.ReactNode>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const montado = doc != null;
  const abrir = async () => {
    setOcupado(true);
    try {
      setDoc(typeof documento === "function" ? await documento() : documento);
    } finally {
      setOcupado(false);
    }
  };
  React.useEffect(() => {
    if (!montado) return;
    const tituloAntes = document.title;
    // O nome do arquivo sugerido pelo navegador vem do título da página.
    document.title = arquivo;
    document.body.classList.add("imprimindo-cv");
    const fim = () => {
      document.body.classList.remove("imprimindo-cv");
      document.title = tituloAntes;
      setDoc(null);
    };
    window.addEventListener("afterprint", fim, { once: true });
    const id = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("afterprint", fim);
      document.body.classList.remove("imprimindo-cv");
      document.title = tituloAntes;
    };
  }, [montado, arquivo]);
  return (
    <>
      <button type="button" className={buttonClasses(variant, "md")} data-action="baixar-pdf" disabled={ocupado} onClick={() => void abrir()}>
        {label}
      </button>
      {montado ? createPortal(<div className="cv-impressao">{doc}</div>, document.body) : null}
    </>
  );
}
