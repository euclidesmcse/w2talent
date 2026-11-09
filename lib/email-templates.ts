/**
 * Textos dos e-mails da higiene (1.5.15) em PT, EN e ES. Curtos, um botão só, no visual da marca.
 * Lembretes D150/D165/D175 antes de o perfil sair da busca; D180 avisa que saiu e quando será apagado.
 */

export type HygieneMarco = "D150" | "D165" | "D175" | "D180";
export type EmailLocale = "pt-BR" | "en" | "es";

export function emailLocale(idioma: string | null | undefined): EmailLocale {
  const v = (idioma ?? "").toLowerCase();
  if (v.startsWith("en")) return "en";
  if (v.startsWith("es")) return "es";
  return "pt-BR";
}

type Copy = {
  ola: (nome: string) => string;
  lembreteAssunto: (dias: number) => string;
  lembreteTexto: (dias: number) => string;
  arquivadoAssunto: string;
  arquivadoTexto: (diasApagar: number) => string;
  botao: string;
  botaoVolta: string;
  rodape: string;
};

const COPY: Record<EmailLocale, Copy> = {
  "pt-BR": {
    ola: (n) => `Olá, ${n}`,
    lembreteAssunto: (d) => `Seu perfil sai da busca em ${d} dias`,
    lembreteTexto: (d) =>
      `Seu perfil no W2Talent sai da busca dos recrutadores em ${d} dias. Se você ainda está procurando, é só confirmar no botão abaixo e ele continua visível por mais 180 dias.`,
    arquivadoAssunto: "Seu perfil saiu da busca",
    arquivadoTexto: (d) =>
      `Seu perfil no W2Talent saiu da busca dos recrutadores. Ele será apagado de vez em ${d} dias. Se ainda está procurando, confirme no botão abaixo e ele volta na hora.`,
    botao: "Continuo procurando",
    botaoVolta: "Quero voltar para a busca",
    rodape: "Você recebe este aviso porque tem um perfil no W2Talent. Se não fizer nada, seus dados são apagados no prazo acima.",
  },
  en: {
    ola: (n) => `Hi ${n}`,
    lembreteAssunto: (d) => `Your profile leaves search in ${d} days`,
    lembreteTexto: (d) =>
      `Your W2Talent profile will leave recruiter search in ${d} days. If you are still looking, confirm with the button below and it stays visible for another 180 days.`,
    arquivadoAssunto: "Your profile left search",
    arquivadoTexto: (d) =>
      `Your W2Talent profile has left recruiter search. It will be permanently deleted in ${d} days. If you are still looking, confirm with the button below and it comes back right away.`,
    botao: "I'm still looking",
    botaoVolta: "Put me back in search",
    rodape: "You get this notice because you have a W2Talent profile. If you do nothing, your data is deleted by the date above.",
  },
  es: {
    ola: (n) => `Hola, ${n}`,
    lembreteAssunto: (d) => `Tu perfil sale de la búsqueda en ${d} días`,
    lembreteTexto: (d) =>
      `Tu perfil en W2Talent saldrá de la búsqueda de los reclutadores en ${d} días. Si todavía estás buscando, confírmalo con el botón de abajo y seguirá visible otros 180 días.`,
    arquivadoAssunto: "Tu perfil salió de la búsqueda",
    arquivadoTexto: (d) =>
      `Tu perfil en W2Talent salió de la búsqueda de los reclutadores. Se borrará definitivamente en ${d} días. Si todavía estás buscando, confírmalo con el botón de abajo y vuelve al instante.`,
    botao: "Sigo buscando",
    botaoVolta: "Quiero volver a la búsqueda",
    rodape: "Recibes este aviso porque tienes un perfil en W2Talent. Si no haces nada, tus datos se borran en el plazo indicado.",
  },
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function primeiroNome(nome: string | null | undefined): string {
  const n = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return n.slice(0, 40);
}

export type HygieneEmailInput = {
  marco: HygieneMarco;
  locale: EmailLocale;
  nome?: string | null;
  renewUrl: string;
  /** Lembrete: dias até sair da busca. Arquivado: dias até ser apagado. */
  dias: number;
};

export function renderHygieneEmail(input: HygieneEmailInput): { subject: string; html: string; text: string } {
  const c = COPY[input.locale];
  const nome = primeiroNome(input.nome);
  const dias = Math.max(1, Math.round(input.dias));
  const arquivado = input.marco === "D180";
  const subject = arquivado ? c.arquivadoAssunto : c.lembreteAssunto(dias);
  const corpo = arquivado ? c.arquivadoTexto(dias) : c.lembreteTexto(dias);
  const botao = arquivado ? c.botaoVolta : c.botao;
  const saudacao = nome ? c.ola(nome) : c.ola("").replace(/,?\s*$/, "");

  const text = `${saudacao},\n\n${corpo}\n\n${botao}: ${input.renewUrl}\n\n${c.rodape}\n`;
  const lang = input.locale === "pt-BR" ? "pt-BR" : input.locale;
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:24px"><p style="margin:0 0 12px">${esc(saudacao)},</p><p style="margin:0">${esc(corpo)}</p></td></tr>
<tr><td style="padding:24px"><a href="${esc(input.renewUrl)}" style="display:inline-block;background:#1F4FD8;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:6px">${esc(botao)}</a></td></tr>
<tr><td style="padding:0 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// ── Candidatura para a empresa (1.5.13) ──────────────────────────────────

type CandidaturaCopy = {
  assunto: (titulo: string, nome: string) => string;
  intro: (nome: string, titulo: string) => string;
  match: (pct: number) => string;
  anos: (n: number) => string;
  pretensao: string;
  resumo: string;
  competencias: string;
  destaques: string;
  idiomas: string;
  referencia: string;
  rodape: string;
};

const CANDIDATURA: Record<EmailLocale, CandidaturaCopy> = {
  "pt-BR": {
    assunto: (t, n) => `Candidatura para ${t}: ${n}`,
    intro: (n, t) => `${n} se candidatou à vaga ${t} pelo W2Talent. A pessoa leu a vaga e aprovou o envio.`,
    match: (p) => `Match com a vaga: ${p}%`,
    anos: (n) => (n === 1 ? "1 ano de experiência" : `${n} anos de experiência`),
    pretensao: "Pretensão",
    resumo: "Resumo",
    competencias: "Competências",
    destaques: "Destaques",
    idiomas: "Idiomas",
    referencia: "Referência da candidatura",
    rodape: "O e-mail e o telefone do candidato ficam protegidos. Responder pelo W2Talent chega em breve; guarde a referência acima.",
  },
  en: {
    assunto: (t, n) => `Application for ${t}: ${n}`,
    intro: (n, t) => `${n} applied to your ${t} opening on W2Talent. They read the job post and approved sending it.`,
    match: (p) => `Match with the job: ${p}%`,
    anos: (n) => (n === 1 ? "1 year of experience" : `${n} years of experience`),
    pretensao: "Expected pay",
    resumo: "Summary",
    competencias: "Skills",
    destaques: "Highlights",
    idiomas: "Languages",
    referencia: "Application reference",
    rodape: "The candidate's e-mail and phone stay protected. Replying through W2Talent is coming soon; keep the reference above.",
  },
  es: {
    assunto: (t, n) => `Postulación para ${t}: ${n}`,
    intro: (n, t) => `${n} se postuló a la vacante ${t} en W2Talent. Leyó la vacante y aprobó el envío.`,
    match: (p) => `Match con la vacante: ${p}%`,
    anos: (n) => (n === 1 ? "1 año de experiencia" : `${n} años de experiencia`),
    pretensao: "Pretensión",
    resumo: "Resumen",
    competencias: "Habilidades",
    destaques: "Destacados",
    idiomas: "Idiomas",
    referencia: "Referencia de la postulación",
    rodape: "El e-mail y el teléfono del candidato están protegidos. Responder por W2Talent llegará pronto; guarda la referencia de arriba.",
  },
};

export type CandidaturaEmailInput = {
  locale: EmailLocale;
  vagaTitulo: string;
  /** "Ana S.": nunca o nome completo. */
  nomeCurto: string;
  /** Título, anos, local: já montado. */
  cargo: string;
  anos: number;
  pretensao: string;
  resumo: string;
  competencias: string[];
  destaques: string[];
  idiomas: string[];
  matchPct: number;
  referencia: string;
};

export function renderCandidaturaEmail(i: CandidaturaEmailInput): { subject: string; html: string; text: string } {
  const c = CANDIDATURA[i.locale];
  const subject = c.assunto(i.vagaTitulo, i.nomeCurto);
  const linhaCargo = [i.cargo, i.anos > 0 ? c.anos(i.anos) : ""].filter(Boolean).join(" · ");
  const blocos: [string, string | string[]][] = [
    [c.pretensao, i.pretensao],
    [c.resumo, i.resumo],
    [c.competencias, i.competencias.join(" · ")],
    [c.destaques, i.destaques],
    [c.idiomas, i.idiomas.join(" · ")],
  ];
  const cheios = blocos.filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v));

  const text = [
    c.intro(i.nomeCurto, i.vagaTitulo),
    c.match(i.matchPct),
    "",
    `${i.nomeCurto}${linhaCargo ? ` · ${linhaCargo}` : ""}`,
    ...cheios.flatMap(([k, v]) => ["", `${k}:`, ...(Array.isArray(v) ? v.map((x) => `- ${x}`) : [v])]),
    "",
    `${c.referencia}: ${i.referencia}`,
    "",
    c.rodape,
    "",
  ].join("\n");

  const lang = i.locale;
  const secao = ([k, v]: [string, string | string[]]) =>
    `<p style="margin:16px 0 4px;font-size:13px;color:#4B5563;font-weight:600">${esc(k)}</p>` +
    (Array.isArray(v)
      ? `<ul style="margin:0;padding-left:20px">${v.map((x) => `<li style="margin:0 0 4px">${esc(x)}</li>`).join("")}</ul>`
      : `<p style="margin:0">${esc(v)}</p>`);
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:15px;line-height:22px"><p style="margin:0 0 8px">${esc(c.intro(i.nomeCurto, i.vagaTitulo))}</p><p style="margin:0;font-weight:600;color:#1F4FD8">${esc(c.match(i.matchPct))}</p></td></tr>
<tr><td style="padding:16px 24px 0"><div style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;font-size:14px;line-height:21px">
<p style="margin:0;font-weight:600">${esc([i.nomeCurto, linhaCargo].filter(Boolean).join(" · "))}</p>${cheios.map(secao).join("")}
</div></td></tr>
<tr><td style="padding:16px 24px 0;font-size:13px;color:#4B5563">${esc(c.referencia)}: <span style="font-family:monospace">${esc(i.referencia)}</span></td></tr>
<tr><td style="padding:16px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
