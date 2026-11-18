"use client";
/**
 * 2.6a: link "Ajuda" do topo. Leva a tela atual (?de=) para a Ajuda mostrar primeiro os artigos dela.
 * Usa o caminho de verdade, não o item ativo do menu: telas fora do menu (/ia, /conta/seguranca, /renovar…) também contam.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

export function LinkAjuda({ children }: { children: React.ReactNode }) {
  const caminho = usePathname() ?? "";
  const de = caminho && !caminho.startsWith("/ajuda") ? caminho : "";
  return (
    <Link
      href={de ? `/ajuda?de=${encodeURIComponent(de)}` : "/ajuda"}
      data-link-ajuda
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-pill px-2 text-sm font-medium text-ink-soft hover:bg-canvas hover:text-ink hover:no-underline"
    >
      {children}
    </Link>
  );
}
