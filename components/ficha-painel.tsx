"use client";
/**
 * Painel ao lado da tabela Candidatos (2.2c): a Ficha W2 abre aqui no computador, sem cobrir a lista.
 * Não é modal: a tabela continua usável e "Ver" em outra linha troca o candidato do painel.
 * Celular e tablet continuam com a janela (DetailModal).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { DetailBody } from "@/components/detail-modal";

export function FichaPainel({
  item,
  titulo,
  antes,
  onClose,
  triggerRef,
}: {
  item: any;
  titulo: string;
  antes?: React.ReactNode;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("detail");
  const tituloRef = React.useRef<HTMLHeadingElement | null>(null);
  const chave = item?.id ?? item?.userId;

  // Ao abrir ou trocar de candidato, o foco vai para o nome, para o leitor de tela anunciar.
  React.useEffect(() => {
    tituloRef.current?.focus();
  }, [chave]);

  const fechar = React.useCallback(() => {
    // O foco volta para o "Ver" que abriu antes de o painel sair, sem esperar o próximo quadro.
    triggerRef?.current?.focus();
    onClose();
  }, [onClose, triggerRef]);

  return (
    <aside
      data-testid="ficha-painel"
      aria-labelledby="ficha-painel-titulo"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          fechar();
        }
      }}
      className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="ficha-painel-titulo" ref={tituloRef} tabIndex={-1} className="text-lg font-semibold leading-snug outline-none">
          {titulo}
        </h2>
        <button
          type="button"
          aria-label={t("closeLabel")}
          onClick={fechar}
          className="shrink-0 rounded-control px-2 py-1 text-muted hover:bg-canvas hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div className="mt-4">
        <DetailBody item={item} antes={antes} />
      </div>
    </aside>
  );
}
