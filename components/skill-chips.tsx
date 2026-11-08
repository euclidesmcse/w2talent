import * as React from "react";
import { getSkill } from "@/lib/taxonomy";
import { skillsDisplay } from "@/lib/format";

/** Nome legível da competência ("aws" → "AWS", "csharp" → "C#"); cai no próprio id se não estiver na taxonomia. */
export function skillName(id: string): string {
  return getSkill(id)?.label ?? id;
}

/** Competências como etiquetas (mesmo visual do Chip neutro, em tamanho compacto), com "+N" quando passam do limite. A lista completa fica no title. */
export function SkillChips({ ids, limit = 3 }: { ids: string[]; limit?: number }) {
  if (!ids.length) return <span aria-label="skills">—</span>;
  const names = ids.map(skillName);
  const visible = names.slice(0, limit);
  const rest = names.length - visible.length;
  return (
    <span aria-label="skills" title={skillsDisplay(names, names.length)} className="flex flex-wrap gap-1.5">
      {visible.map((n) => (
        <span key={n} className="inline-flex h-6 items-center rounded-full bg-neutral-soft px-2 text-xs font-medium text-ink-soft">
          {n}
        </span>
      ))}
      {rest > 0 ? (
        <span className="inline-flex h-6 items-center px-1 text-xs font-medium text-muted">+{rest}</span>
      ) : null}
    </span>
  );
}
