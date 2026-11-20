// O projeto não tem @types/react-dom; só o createPortal é usado (painel do CV completo, linha do tempo PR c).
declare module "react-dom" {
  import type { ReactNode, ReactPortal } from "react";
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal;
}
