"use client";
import * as React from "react";

/**
 * ContactBatchModal — Task 8
 * - 1 template editável (IA sugere subject/body se vazio)
 * - lista preview expansível por candidato (personalização opcional)
 * - geração subject/body via LLM se vazio (stub suggestContactContent)
 * - disparo N threads proxy (via POST /api/contacts/batch)
 * - limites 10/lote 30/dia exibidos
 */

export type CandidatePreview = {
  userId: string;
  nome: string;
  titulo?: string;
  email?: string; // mascarado: **@...
  celular?: string;
  stack?: any[];
  masked?: boolean;
};

export type ContactBatchModalProps = {
  open: boolean;
  onClose: () => void;
  candidateIds: string[];
  candidates?: CandidatePreview[];
  companyId?: string;
  rhId?: string;
  onSent?: (results: any[]) => void;
};

function suggestLocal(candidate: CandidatePreview): { subject: string; body: string } {
  const nome = candidate.nome ?? "candidato";
  const titulo = candidate.titulo ?? "Profissional";
  const skill = (candidate.stack?.[0] as any)?.skillId ?? "Cloud";
  return {
    subject: `Oportunidade: ${titulo} • ${String(skill).toUpperCase()} — convite via W2Talent`,
    body: `Olá ${nome},\n\nSeu perfil "${titulo}" chamou atenção — ${skill}. Temos oportunidade remota alinhada.\nGostaria de conversar esta semana? Responda este e-mail (proxy) para liberar contato direto.`,
  };
}

export function ContactBatchModal({
  open,
  onClose,
  candidateIds,
  candidates = [],
  companyId,
  rhId,
  onSent,
}: ContactBatchModalProps) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [perCandidate, setPerCandidate] = React.useState<Record<string, { subject: string; body: string }>>({});
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<any[] | null>(null);

  const count = candidateIds.length;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setResults(null);
  }, [open]);

  const getPreviewFor = (id: string): { subject: string; body: string } => {
    if (perCandidate[id]) return perCandidate[id];
    // se template global preenchido, usa template; senão IA sugere por candidato
    if (subject.trim() || body.trim()) {
      const cand = candidates.find((c) => c.userId === id);
      const base = cand ? suggestLocal(cand) : { subject: "Oportunidade via W2Talent", body: "Olá, temos oportunidade alinhada..." };
      return {
        subject: subject.trim() || base.subject,
        body: body.trim() || base.body,
      };
    }
    const cand = candidates.find((c) => c.userId === id) ?? { userId: id, nome: id, titulo: "Profissional" } as any;
    return suggestLocal(cand);
  };

  const handleSend = async () => {
    if (count === 0) { setError("selecione ao menos 1 candidato"); return; }
    if (count > 10) { setError(`limite de 10 por lote — selecionados: ${count}`); return; }
    setSending(true);
    setError(null);
    try {
      // se usuário dejó template vazio, back-end vai gerar via IA; mas para preview mostramos sugestão
      // personalização opcional: se perCandidate overrides existem, envia 1 template + custom map?
      // spec: 1 template com preview por candidato (expansível para personalizar 1) — MVP envia 1 template global
      // personalizações individuais seriam aplicadas no back-end por candidato via suggest fallback
      const payload: any = {
        candidateIds,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        companyId,
        rhId,
      };
      // se houver personalização por candidato, envia mapa (opcional)
      const hasCustom = Object.keys(perCandidate).length > 0;
      if (hasCustom) payload.perCandidate = perCandidate;

      const res = await fetch("/api/contacts/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        const msg = json.error ?? `erro ${res.status}`;
        // 429 limite diário
        if (res.status === 429) throw new Error(msg + " — limite diário 30/dia");
        if (res.status === 400 && /limite.*10/.test(msg.toLowerCase())) throw new Error(msg);
        // para 207 parcial, ainda mostra results
        if (!json.results) throw new Error(msg);
      }
      const resResults = json.results ?? [];
      setResults(resResults);
      onSent?.(resResults);
    } catch (e: any) {
      setError(e.message ?? "falha ao enviar lote");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Contato em lote — 1 template + preview"
      data-testid="contact-batch-modal"
      className="contact-batch-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-xl p-6">
        <div className="flex justify-between items-start gap-4">
          <h2 className="text-lg font-semibold">Contatar em lote — 1 template + preview</h2>
          <button type="button" aria-label="Fechar modal contato" onClick={onClose} className="rounded p-2 hover:bg-zinc-100">✕</button>
        </div>
        <p className="text-sm text-zinc-500 mt-1">Contatar ({count}) — limite 10 por lote, 30 por dia por RH. IA sugere subject/corpo se deixar vazio. Preview expansível por candidato com personalização opcional.</p>
        {error ? <div role="alert" className="mt-2 text-sm text-red-600">{error}</div> : null}

        {/* Template editável — 1 template */}
        <div className="mt-4 space-y-3 border rounded-lg p-3 bg-zinc-50">
          <label className="block">
            <span className="text-sm font-medium">Subject (template único)</span>
            <input
              aria-label="subject template"
              placeholder="IA sugere subject se deixar vazio — ex: Oportunidade Cloud remota"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              data-testid="contact-subject"
            />
            <span className="text-xs text-zinc-500">IA sugere subject se não informado</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Body (template único)</span>
            <textarea
              aria-label="body template"
              placeholder="IA sugere corpo se deixar vazio — mensagem personalizada por candidato no preview"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              data-testid="contact-body"
            />
            <span className="text-xs text-zinc-500">IA sugere body se não informado — cada candidato vê preview personalizado</span>
          </label>
          <div className="text-xs text-zinc-400">Limite 10 por lote, 30/dia RH — mascarado até envio — resposta no proxy libera contato direto (B)</div>
        </div>

        {/* Lista preview expansível por candidato */}
        <div className="mt-4">
          <h3 className="text-sm font-medium">Preview por candidato — expansível (personalização opcional)</h3>
          <ul className="mt-2 space-y-2" aria-label="lista preview candidatos">
            {candidateIds.map((id) => {
              const cand = candidates.find((c) => c.userId === id) ?? { userId: id, nome: id } as any;
              const isExpanded = !!expanded[id];
              const preview = getPreviewFor(id);
              const custom = perCandidate[id];
              return (
                <li key={id} className="border rounded p-3" data-testid={`preview-${id}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cand.nome} — {cand.titulo ?? "—"} <span className="text-zinc-400 text-xs">{cand.email ? `${cand.email.slice(0,2)}***` : ""}</span></span>
                    <button
                      type="button"
                      aria-label={`expandir preview ${id}`}
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded((m) => ({ ...m, [id]: !m[id] }))}
                      className="text-xs rounded border px-2 py-1"
                    >
                      {isExpanded ? "recolher" : "preview / personalizar"}
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">Subject preview: {preview.subject} — Body preview: {preview.body.slice(0, 80)}...</div>
                  {isExpanded ? (
                    <div className="mt-2 space-y-2 bg-white border rounded p-2">
                      <input
                        aria-label={`subject personalizado ${id}`}
                        placeholder="Subject personalizado (opcional)"
                        value={custom?.subject ?? ""}
                        onChange={(e) => setPerCandidate((m) => ({ ...m, [id]: { subject: e.target.value, body: m[id]?.body ?? "" } }))}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                      <textarea
                        aria-label={`body personalizado ${id}`}
                        placeholder="Body personalizado (opcional) — expande se quiser personalizar 1"
                        value={custom?.body ?? ""}
                        onChange={(e) => setPerCandidate((m) => ({ ...m, [id]: { subject: m[id]?.subject ?? "", body: e.target.value } }))}
                        rows={2}
                        className="w-full rounded border px-2 py-1 text-xs"
                      />
                      <div className="text-xs text-zinc-400">Deixe vazio para usar template global + IA personalizada</div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            aria-label="enviar lote contato"
            onClick={handleSend}
            disabled={sending || count === 0}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {sending ? "enviando..." : `Contatar (${count}) — 5 threads proxy`}
          </button>
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancelar</button>
        </div>

        {results ? (
          <div role="status" className="mt-4 border rounded p-3 bg-green-50 text-sm">
            <strong>{results.filter((r:any)=>r.status==="enviado").length} enviados — via proxy id@via.w2talent.com</strong>
            <ul className="mt-1">
              {results.map((r: any) => (
                <li key={r.candidateId ?? r.proxyThreadId}>{r.candidateId ?? r.proxyThreadId}: {r.status} {r.proxyThreadId ? `(${r.proxyThreadId})` : ""} {r.subject ? `— ${r.subject}` : ""}</li>
              ))}
            </ul>
            <div className="text-xs text-zinc-500">Mascarado até envio — resposta no proxy libera contato direto (B) e loga consentimento</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ContactBatchModal;
