"use client";

import * as React from "react";
import { AppHeader } from "@/components/app-header";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Field,
  Input,
  MatchBar,
  Select,
  StatCard,
  StatusBadge,
  Table,
  THead,
  Th,
  Tr,
  Td,
  useToast,
} from "@/components/ui";
import { colors } from "@/lib/design-tokens";

/** Vitrine do design system v2: confere os componentes base contra o protótipo aprovado. */
export default function DesignPage() {
  const toast = useToast();
  const [chips, setChips] = React.useState(["Remoto", "PJ", "AWS"]);
  const swatches: Array<[string, string]> = [
    ["Ação", colors.brand.DEFAULT],
    ["Texto", colors.ink.DEFAULT],
    ["Texto secundário", colors.muted.DEFAULT],
    ["Borda", colors.line.DEFAULT],
    ["Fundo", colors.canvas],
    ["Sucesso", colors.success.DEFAULT],
    ["Atenção", colors.warning.DEFAULT],
    ["Erro", colors.danger.DEFAULT],
  ];

  return (
    <div className="min-h-screen">
      <AppHeader area="Design system" />
      <main className="mx-auto flex max-w-page flex-col gap-8 px-6 py-8">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">Design system v2</h1>
          <p className="mt-1 max-w-[640px] text-muted">
            Limpo e leve: fundo neutro, uma cor de ação, informação densa e escaneável. Inter · grade 4/8 px · raio 6.
          </p>
        </div>

        <section aria-labelledby="cores" className="flex flex-col gap-3">
          <h2 id="cores" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Cores</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {swatches.map(([nome, hex]) => (
              <Card key={nome} className="overflow-hidden">
                <div className="h-14 border-b border-line" style={{ background: hex }} />
                <div className="px-3 py-2.5 text-[13px]">
                  <strong className="font-semibold">{nome}</strong>
                  <div className="font-mono text-muted">{hex}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Tipografia" />
            <CardBody className="flex flex-col gap-3">
              <p className="text-[32px] font-bold leading-tight tracking-[-0.02em]">Título 32 / 700</p>
              <p className="text-xl font-semibold">Seção 20 / 600</p>
              <p>Corpo 15 / 400. Texto de leitura em listas, fichas e descrições de vaga.</p>
              <p className="text-[13px] text-muted">Apoio 13 / 400 · metadados, datas, legendas</p>
              <p className="font-mono text-[13px] text-muted">Mono 13 · ids, valores, códigos</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Botões e campos" />
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2.5">
                <Button onClick={() => toast.show("3 candidaturas enviadas.", "success")}>Enviar aprovadas (3)</Button>
                <Button variant="secondary" onClick={() => toast.show("Abrindo detalhes…")}>Ver detalhes</Button>
                <Button variant="ghost" onClick={() => toast.show("Limite de 30 por dia atingido.", "warning")}>Limpar</Button>
                <Button variant="danger" onClick={() => toast.show("Não foi possível enviar. Tente de novo.", "error")}>Excluir</Button>
                <Button disabled>Desativado</Button>
              </div>
              <Field label="Buscar vagas" hint="Escreva como falaria.">
                <Input type="search" defaultValue="DevOps remoto PJ 15k" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Regime">
                  <Select defaultValue="PJ">
                    <option>CLT</option>
                    <option>PJ</option>
                  </Select>
                </Field>
                <Field label="E-mail" error="E-mail inválido.">
                  <Input aria-invalid="true" defaultValue="ana@" />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Chip key={c} onRemove={() => setChips((xs) => xs.filter((x) => x !== c))}>{c}</Chip>
                ))}
                <Chip tone="neutral">CKA · desejável</Chip>
                <Chip tone="add">+ Filtro</Chip>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Status de candidatura e match" />
          <CardBody className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status="selecionada" />
            <StatusBadge status="revisada" />
            <StatusBadge status="aprovada" />
            <StatusBadge status="enviada">Enviada 08/11</StatusBadge>
            <StatusBadge status="reaprovar" />
            <span className="flex-1" />
            <MatchBar value={87} />
          </CardBody>
        </Card>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <StatCard label="Vagas abertas" value="6" />
          <StatCard label="Candidaturas novas (7 dias)" value="47" />
          <StatCard label="Entrevistas esta semana" value="5" />
          <StatCard label="Tempo médio até contratar" value="21 dias" />
        </div>

        <Card className="overflow-hidden">
          <CardHeader title="Tabela" />
          <Table>
            <THead>
              <Th>Vaga</Th>
              <Th>Match</Th>
              <Th>Status</Th>
              <Th className="text-right">Publicada</Th>
            </THead>
            <tbody>
              <Tr selected>
                <Td><div className="font-semibold">DevOps Sênior</div><div className="text-[13px] text-muted">Remoto · PJ</div></Td>
                <Td><MatchBar value={87} /></Td>
                <Td><StatusBadge status="aprovada" /></Td>
                <Td className="text-right text-[13px] text-muted">há 2 dias</Td>
              </Tr>
              <Tr>
                <Td><div className="font-semibold">SRE Pleno</div><div className="text-[13px] text-muted">Remoto · PJ</div></Td>
                <Td><MatchBar value={62} /></Td>
                <Td><StatusBadge status="selecionada" /></Td>
                <Td className="text-right text-[13px] text-muted">há 5 dias</Td>
              </Tr>
            </tbody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
