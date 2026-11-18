"use client";
/** Filtros da tela Candidatos (2.2b): vaga de referência + filtros combináveis, guardados na URL. */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, Select } from "@/components/ui";
import { DISPONIBILIDADES, MODOS, NIVEIS_IDIOMA, SENIORIDADES } from "@/lib/ficha";
import { ATUALIZADA_DIAS, contarFiltros, IDIOMAS_FILTRO, MAX_SKILLS_FILTRO, REGIMES_FILTRO, type FiltrosCandidatos } from "@/lib/candidatos-filtros";
import { getSkill, normalizeSkill } from "@/lib/taxonomy";

export type VagaOpcao = { id: string; titulo: string; nivel?: string | null; regime?: string | null };

const textoSkills = (ids: string[]) => ids.map((id) => getSkill(id)?.label ?? id).join(", ");

export function CandidatosFiltros({
  filtros,
  onChange,
  vagas,
}: {
  filtros: FiltrosCandidatos;
  onChange: (f: FiltrosCandidatos) => void;
  vagas: VagaOpcao[] | null;
}) {
  const t = useTranslations("candidatos.filtros");
  const tf = useTranslations("ficha");
  const ativos = contarFiltros(filtros);
  const [aberto, setAberto] = React.useState(ativos > 0);
  const [skillsTexto, setSkillsTexto] = React.useState(() => textoSkills(filtros.skills));
  const [desconhecidas, setDesconhecidas] = React.useState<string[]>([]);
  const painelId = React.useId();
  const ajudaVagaId = React.useId();

  // Filtros trocados por fora (limpar, voltar do navegador): o campo de texto acompanha.
  const chaveSkills = filtros.skills.join(",");
  React.useEffect(() => {
    setSkillsTexto(textoSkills(chaveSkills ? chaveSkills.split(",") : []));
  }, [chaveSkills]);

  // Pretensão: o campo guarda o que se digita e só busca ao sair do campo ou no Enter.
  const [faixa, setFaixa] = React.useState(() => (filtros.faixaAte ? String(filtros.faixaAte) : ""));
  React.useEffect(() => {
    setFaixa(filtros.faixaAte ? String(filtros.faixaAte) : "");
  }, [filtros.faixaAte]);

  const set = <K extends keyof FiltrosCandidatos>(k: K, v: FiltrosCandidatos[K]) => onChange({ ...filtros, [k]: v });
  const aplicarFaixa = () => {
    const n = Number(faixa);
    const valor = faixa.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
    if (valor !== filtros.faixaAte) set("faixaAte", valor);
  };
  const aplicarSkills = () => {
    const partes = skillsTexto.split(",").map((s) => s.trim()).filter(Boolean);
    const ids: string[] = [];
    const nao: string[] = [];
    for (const p of partes) {
      const id = normalizeSkill(p);
      if (id) { if (!ids.includes(id)) ids.push(id); } else nao.push(p);
    }
    setDesconhecidas(nao);
    const novos = ids.slice(0, MAX_SKILLS_FILTRO);
    if (novos.join(",") !== filtros.skills.join(",")) set("skills", novos);
  };
  const qualquer = <option value="">{t("qualquer")}</option>;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("vaga")} className="min-w-0 max-w-[420px] flex-[1_1_260px]">
          <Select data-testid="filtro-vaga" aria-describedby={ajudaVagaId} value={filtros.vaga ?? ""} onChange={(e) => set("vaga", e.target.value || undefined)} disabled={!vagas?.length}>
            <option value="">{t("vagaNenhuma")}</option>
            {(vagas ?? []).map((v) => (
              <option key={v.id} value={v.id}>{[v.titulo, v.nivel, v.regime].filter(Boolean).join(" · ")}</option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" size="md" aria-expanded={aberto} aria-controls={painelId} onClick={() => setAberto((a) => !a)} data-testid="filtros-toggle">
          {t("mostrar")}{ativos ? ` · ${t("ativos", { count: ativos })}` : ""}
        </Button>
        {ativos ? (
          <Button variant="ghost" size="md" onClick={() => onChange({ vaga: filtros.vaga, skills: [] })}>{t("limpar")}</Button>
        ) : null}
      </div>
      <p id={ajudaVagaId} className="-mt-1 text-[13px] text-muted">{vagas && !vagas.length ? t("semVagas") : t("vagaAjuda")}</p>
      <div id={painelId} hidden={!aberto} data-testid="filtros-painel" className="rounded-card border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label={t("skills")} hint={desconhecidas.length ? t("skillsDesconhecidas", { lista: desconhecidas.join(", ") }) : t("skillsAjuda")} className="col-span-2">
            <Input
              value={skillsTexto}
              onChange={(e) => setSkillsTexto(e.target.value)}
              onBlur={aplicarSkills}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarSkills(); } }}
              placeholder="AWS, Terraform"
              data-testid="filtro-skills"
            />
          </Field>
          <Field label={t("senioridade")}>
            <Select value={filtros.senioridade ?? ""} onChange={(e) => set("senioridade", (e.target.value || undefined) as FiltrosCandidatos["senioridade"])}>
              {qualquer}
              {SENIORIDADES.map((s) => <option key={s} value={s}>{tf(`sen_${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("modo")}>
            <Select value={filtros.modo ?? ""} onChange={(e) => set("modo", (e.target.value || undefined) as FiltrosCandidatos["modo"])}>
              {qualquer}
              {MODOS.map((m) => <option key={m} value={m}>{tf(`modo_${m}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("regime")}>
            <Select value={filtros.regime ?? ""} onChange={(e) => set("regime", (e.target.value || undefined) as FiltrosCandidatos["regime"])}>
              {qualquer}
              {REGIMES_FILTRO.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label={t("faixaAte")}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={faixa}
              onChange={(e) => setFaixa(e.target.value)}
              onBlur={aplicarFaixa}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarFaixa(); } }}
            />
          </Field>
          <Field label={t("idioma")}>
            <Select value={filtros.idioma ?? ""} onChange={(e) => onChange({ ...filtros, idioma: (e.target.value || undefined) as FiltrosCandidatos["idioma"], idiomaNivel: e.target.value ? filtros.idiomaNivel : undefined })}>
              {qualquer}
              {IDIOMAS_FILTRO.map((i) => <option key={i} value={i}>{t(`idiomas.${i}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("idiomaNivel")}>
            <Select value={filtros.idiomaNivel ?? ""} disabled={!filtros.idioma} onChange={(e) => set("idiomaNivel", (e.target.value || undefined) as FiltrosCandidatos["idiomaNivel"])}>
              {qualquer}
              {NIVEIS_IDIOMA.map((n) => <option key={n} value={n}>{tf(`niv_${n}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("disponibilidade")}>
            <Select value={filtros.disponibilidade ?? ""} onChange={(e) => set("disponibilidade", (e.target.value || undefined) as FiltrosCandidatos["disponibilidade"])}>
              {qualquer}
              {DISPONIBILIDADES.map((d) => <option key={d} value={d}>{tf(`disp_${d}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("atualizada")}>
            <Select value={filtros.atualizadaDias ?? ""} onChange={(e) => set("atualizadaDias", (Number(e.target.value) || undefined) as FiltrosCandidatos["atualizadaDias"])}>
              {qualquer}
              {ATUALIZADA_DIAS.map((d) => <option key={d} value={d}>{t("atualizadaDias", { dias: d })}</option>)}
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}
