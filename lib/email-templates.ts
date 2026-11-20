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
  /** Coach IA por vaga: carta do candidato e aviso de que resumo e destaques foram feitos para esta vaga. */
  carta: string;
  adaptadaIa: string;
  adaptada: string;
  /** CV por vaga: frase "por que se destaca" e os cargos com os pontos escolhidos para a vaga. */
  porQue: string;
  experiencia: string;
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
    carta: "Mensagem do candidato",
    adaptadaIa: "Resumo, destaques, experiência e mensagem adaptados a esta vaga pelo candidato, com ajuda de IA. Tudo vem da ficha dele.",
    adaptada: "Resumo, destaques, experiência e mensagem adaptados a esta vaga pelo candidato.",
    porQue: "Por que se destaca",
    experiencia: "Experiência (versão para esta vaga)",
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
    carta: "Message from the candidate",
    adaptadaIa: "Summary, highlights, experience and message adapted to this job by the candidate, with AI help. Everything comes from their profile.",
    adaptada: "Summary, highlights, experience and message adapted to this job by the candidate.",
    porQue: "Why they stand out",
    experiencia: "Experience (version for this job)",
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
    carta: "Mensaje del candidato",
    adaptadaIa: "Resumen, destacados, experiencia y mensaje adaptados a esta vacante por el candidato, con ayuda de IA. Todo viene de su ficha.",
    adaptada: "Resumen, destacados, experiencia y mensaje adaptados a esta vacante por el candidato.",
    porQue: "Por qué destaca",
    experiencia: "Experiencia (versión para esta vacante)",
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
  /** Coach IA por vaga: carta do candidato (vazio = sem carta). */
  carta?: string;
  /** "ia" ou "candidato" quando resumo e destaques foram adaptados para esta vaga. */
  adaptada?: "ia" | "candidato" | null;
  /** CV por vaga: "por que se destaca" e cargos (título já montado) com os pontos. */
  porQue?: string;
  experiencia?: { titulo: string; pontos: string[] }[];
};

export function renderCandidaturaEmail(i: CandidaturaEmailInput): { subject: string; html: string; text: string } {
  const c = CANDIDATURA[i.locale];
  const subject = c.assunto(i.vagaTitulo, i.nomeCurto);
  const linhaCargo = [i.cargo, i.anos > 0 ? c.anos(i.anos) : ""].filter(Boolean).join(" · ");
  const blocos: [string, string | string[]][] = [
    [c.porQue, i.porQue ?? ""],
    [c.carta, i.carta ?? ""],
    [c.pretensao, i.pretensao],
    [c.resumo, i.resumo],
    [c.competencias, i.competencias.join(" · ")],
    [c.destaques, i.destaques],
    [c.idiomas, i.idiomas.join(" · ")],
  ];
  const exp = (i.experiencia ?? []).filter((x) => x.titulo);
  const cheios = blocos.filter(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v));
  const aviso = i.adaptada === "ia" ? c.adaptadaIa : i.adaptada === "candidato" ? c.adaptada : "";

  const text = [
    c.intro(i.nomeCurto, i.vagaTitulo),
    c.match(i.matchPct),
    "",
    `${i.nomeCurto}${linhaCargo ? ` · ${linhaCargo}` : ""}`,
    ...cheios.flatMap(([k, v]) => ["", `${k}:`, ...(Array.isArray(v) ? v.map((x) => `- ${x}`) : [v])]),
    ...(exp.length ? ["", `${c.experiencia}:`, ...exp.flatMap((x) => ["", x.titulo, ...x.pontos.map((p) => `- ${p}`)])] : []),
    ...(aviso ? ["", aviso] : []),
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
<p style="margin:0;font-weight:600">${esc([i.nomeCurto, linhaCargo].filter(Boolean).join(" · "))}</p>${cheios.map(secao).join("")}${
    exp.length
      ? `<p style="margin:16px 0 4px;font-size:13px;color:#4B5563;font-weight:600">${esc(c.experiencia)}</p>` +
        exp
          .map(
            (x) =>
              `<p style="margin:8px 0 2px;font-weight:600">${esc(x.titulo)}</p>` +
              (x.pontos.length ? `<ul style="margin:0;padding-left:20px">${x.pontos.map((p) => `<li style="margin:0 0 4px">${esc(p)}</li>`).join("")}</ul>` : ""),
          )
          .join("")
      : ""
  }${aviso ? `<p style="margin:16px 0 0;font-size:12px;color:#4B5563">${esc(aviso)}</p>` : ""}
</div></td></tr>
<tr><td style="padding:16px 24px 0;font-size:13px;color:#4B5563">${esc(c.referencia)}: <span style="font-family:monospace">${esc(i.referencia)}</span></td></tr>
<tr><td style="padding:16px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// ── 2.4c Entrevista: aviso ao candidato quando o contato é liberado (plano 2.4, D4) ──

const ENTREVISTA: Record<
  EmailLocale,
  { assunto: (e: string) => string; ola: (n: string) => string; corpo: (e: string, v: string) => string; contato: string; botao: string; rodape: string }
> = {
  "pt-BR": {
    assunto: (e) => `${e} quer conversar com você`,
    ola: (n) => (n ? `Olá, ${n}` : "Olá"),
    corpo: (e, v) => `${e} chamou você para entrevista na vaga ${v}.`,
    contato: "Por isso, a empresa passou a ver o seu e-mail e o seu telefone da Ficha W2 e deve falar com você por eles.",
    botao: "Ver minhas candidaturas",
    rodape: "Você recebeu este aviso porque se candidatou a esta vaga pelo W2Talent.",
  },
  en: {
    assunto: (e) => `${e} wants to talk to you`,
    ola: (n) => (n ? `Hi ${n}` : "Hi"),
    corpo: (e, v) => `${e} invited you to an interview for the ${v} job.`,
    contato: "So the company can now see the e-mail and phone on your W2 profile and should contact you through them.",
    botao: "See my applications",
    rodape: "You got this notice because you applied to this job through W2Talent.",
  },
  es: {
    assunto: (e) => `${e} quiere hablar contigo`,
    ola: (n) => (n ? `Hola, ${n}` : "Hola"),
    corpo: (e, v) => `${e} te llamó a entrevista para la vacante ${v}.`,
    contato: "Por eso, la empresa ahora ve el e-mail y el teléfono de tu Ficha W2 y debería contactarte por ellos.",
    botao: "Ver mis postulaciones",
    rodape: "Recibiste este aviso porque te postulaste a esta vacante por W2Talent.",
  },
};

export type EntrevistaEmailInput = { locale: EmailLocale; nome?: string | null; empresa: string; vagaTitulo: string; url: string };

export function renderEntrevistaEmail(i: EntrevistaEmailInput): { subject: string; html: string; text: string } {
  const c = ENTREVISTA[i.locale];
  const saudacao = c.ola(primeiroNome(i.nome));
  const subject = c.assunto(i.empresa);
  const text = `${saudacao},\n\n${c.corpo(i.empresa, i.vagaTitulo)}\n${c.contato}\n\n${c.botao}: ${i.url}\n\n${c.rodape}\n`;
  const html = `<!doctype html><html lang="${i.locale}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:24px"><p style="margin:0 0 12px">${esc(saudacao)},</p><p style="margin:0 0 8px;font-weight:600">${esc(c.corpo(i.empresa, i.vagaTitulo))}</p><p style="margin:0">${esc(c.contato)}</p></td></tr>
<tr><td style="padding:20px 24px 0"><a href="${esc(i.url)}" style="display:inline-block;background:#1F4FD8;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(c.botao)}</a></td></tr>
<tr><td style="padding:20px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// ── 2.5a Agenda: convite para escolher horário, entrevista marcada e cancelada ──

export type AgendaTipo = "convite" | "marcada" | "trocada" | "cancelada";

type AgendaCopy = {
  ola: (n: string) => string;
  assunto: Record<AgendaTipo, (empresa: string, vaga: string, quando: string) => string>;
  conviteCorpo: (empresa: string, vaga: string, dur: number) => string;
  conviteBotao: string;
  marcadaCorpo: (quem: string, vaga: string, quando: string, dur: number) => string;
  trocadaCorpo: (quem: string, vaga: string, quando: string, dur: number) => string;
  canceladaCorpo: (vaga: string, quando: string | null, porCandidato: boolean) => string;
  link: (url: string) => string;
  semLink: string;
  anexo: string;
  gerenciarBotao: string;
  verCandidaturasBotao: string;
  rodape: string;
};

const AGENDA: Record<EmailLocale, AgendaCopy> = {
  "pt-BR": {
    ola: (n) => (n ? `Olá, ${n}` : "Olá"),
    assunto: {
      convite: (e) => `${e}: escolha o horário da sua entrevista`,
      marcada: (_e, v, q) => `Entrevista marcada: ${v}, ${q}`,
      trocada: (_e, v, q) => `Entrevista remarcada: ${v}, ${q}`,
      cancelada: (_e, v) => `Entrevista cancelada: ${v}`,
    },
    conviteCorpo: (e, v, d) => `${e} quer marcar a sua entrevista para a vaga ${v} (${d} minutos). Escolha um dos horários oferecidos pelo link abaixo.`,
    conviteBotao: "Escolher horário",
    marcadaCorpo: (q, v, w, d) => `A entrevista com ${q} para a vaga ${v} está marcada para ${w} (${d} minutos).`,
    trocadaCorpo: (q, v, w, d) => `A entrevista com ${q} para a vaga ${v} mudou para ${w} (${d} minutos).`,
    canceladaCorpo: (v, w, c) => `A entrevista para a vaga ${v}${w ? ` de ${w}` : ""} foi cancelada ${c ? "pelo candidato" : "pela empresa"}.`,
    link: (u) => `Link da reunião: ${u}`,
    semLink: "O link da reunião ainda não foi informado; a empresa deve mandar por e-mail.",
    anexo: "O convite em anexo (.ics) põe a entrevista na sua agenda.",
    gerenciarBotao: "Ver ou mudar o horário",
    verCandidaturasBotao: "Ver candidaturas da vaga",
    rodape: "Você recebeu este e-mail por causa de uma candidatura feita pelo W2Talent.",
  },
  en: {
    ola: (n) => (n ? `Hi ${n}` : "Hi"),
    assunto: {
      convite: (e) => `${e}: pick a time for your interview`,
      marcada: (_e, v, q) => `Interview booked: ${v}, ${q}`,
      trocada: (_e, v, q) => `Interview moved: ${v}, ${q}`,
      cancelada: (_e, v) => `Interview cancelled: ${v}`,
    },
    conviteCorpo: (e, v, d) => `${e} wants to book your interview for the ${v} job (${d} minutes). Pick one of the times offered using the link below.`,
    conviteBotao: "Pick a time",
    marcadaCorpo: (q, v, w, d) => `The interview with ${q} for the ${v} job is booked for ${w} (${d} minutes).`,
    trocadaCorpo: (q, v, w, d) => `The interview with ${q} for the ${v} job moved to ${w} (${d} minutes).`,
    canceladaCorpo: (v, w, c) => `The interview for the ${v} job${w ? ` on ${w}` : ""} was cancelled by the ${c ? "candidate" : "company"}.`,
    link: (u) => `Meeting link: ${u}`,
    semLink: "The meeting link has not been added yet; the company should send it by e-mail.",
    anexo: "The attached invite (.ics) adds the interview to your calendar.",
    gerenciarBotao: "See or change the time",
    verCandidaturasBotao: "See the job's applications",
    rodape: "You got this e-mail because of an application made through W2Talent.",
  },
  es: {
    ola: (n) => (n ? `Hola, ${n}` : "Hola"),
    assunto: {
      convite: (e) => `${e}: elige el horario de tu entrevista`,
      marcada: (_e, v, q) => `Entrevista agendada: ${v}, ${q}`,
      trocada: (_e, v, q) => `Entrevista reprogramada: ${v}, ${q}`,
      cancelada: (_e, v) => `Entrevista cancelada: ${v}`,
    },
    conviteCorpo: (e, v, d) => `${e} quiere agendar tu entrevista para la vacante ${v} (${d} minutos). Elige uno de los horarios ofrecidos en el enlace de abajo.`,
    conviteBotao: "Elegir horario",
    marcadaCorpo: (q, v, w, d) => `La entrevista con ${q} para la vacante ${v} está agendada para el ${w} (${d} minutos).`,
    trocadaCorpo: (q, v, w, d) => `La entrevista con ${q} para la vacante ${v} cambió al ${w} (${d} minutos).`,
    canceladaCorpo: (v, w, c) => `La entrevista para la vacante ${v}${w ? ` del ${w}` : ""} fue cancelada por ${c ? "el candidato" : "la empresa"}.`,
    link: (u) => `Enlace de la reunión: ${u}`,
    semLink: "El enlace de la reunión aún no fue informado; la empresa debe enviarlo por e-mail.",
    anexo: "La invitación adjunta (.ics) agrega la entrevista a tu calendario.",
    gerenciarBotao: "Ver o cambiar el horario",
    verCandidaturasBotao: "Ver postulaciones de la vacante",
    rodape: "Recibiste este e-mail por una postulación hecha en W2Talent.",
  },
};

/** Data e hora no idioma e fuso de quem recebe, com o nome do fuso (ex.: "qua., 25 de nov. 14:00 BRT"). */
export function quandoEmail(d: Date, locale: EmailLocale, fuso?: string | null): string {
  const tz = fusoValido(fuso) ? fuso! : "UTC";
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(d);
}

export function fusoValido(fuso: string | null | undefined): boolean {
  if (!fuso || fuso.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

export type AgendaEmailInput = {
  tipo: AgendaTipo;
  locale: EmailLocale;
  nome?: string | null;
  empresa: string;
  vagaTitulo: string;
  /** Com quem é a entrevista, para quem recebe (empresa para o candidato, candidato para o recrutador). */
  com: string;
  duracaoMin: number;
  inicio?: Date | null;
  fuso?: string | null;
  linkReuniao?: string | null;
  porCandidato?: boolean;
  /** Botão: o link de escolher horário (candidato) ou a tela da vaga (recrutador). */
  url: string;
  paraRecrutador?: boolean;
  temAnexo?: boolean;
};

export function renderAgendaEmail(i: AgendaEmailInput): { subject: string; html: string; text: string } {
  const c = AGENDA[i.locale];
  const quando = i.inicio ? quandoEmail(i.inicio, i.locale, i.fuso) : "";
  const subject = c.assunto[i.tipo](i.empresa, i.vagaTitulo, quando);
  const paragrafos: string[] = [];
  if (i.tipo === "convite") paragrafos.push(c.conviteCorpo(i.empresa, i.vagaTitulo, i.duracaoMin));
  else if (i.tipo === "marcada") paragrafos.push(c.marcadaCorpo(i.com, i.vagaTitulo, quando, i.duracaoMin));
  else if (i.tipo === "trocada") paragrafos.push(c.trocadaCorpo(i.com, i.vagaTitulo, quando, i.duracaoMin));
  else paragrafos.push(c.canceladaCorpo(i.vagaTitulo, quando || null, !!i.porCandidato));
  if (i.tipo === "marcada" || i.tipo === "trocada") paragrafos.push(i.linkReuniao ? c.link(i.linkReuniao) : c.semLink);
  if (i.temAnexo) paragrafos.push(c.anexo);
  const botao = i.paraRecrutador ? c.verCandidaturasBotao : i.tipo === "convite" ? c.conviteBotao : c.gerenciarBotao;
  const saudacao = c.ola(primeiroNome(i.nome));
  const text = `${saudacao},\n\n${paragrafos.join("\n")}\n\n${botao}: ${i.url}\n\n${c.rodape}\n`;
  const html = `<!doctype html><html lang="${i.locale}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:24px"><p style="margin:0 0 12px">${esc(saudacao)},</p>${paragrafos.map((p, n) => `<p style="margin:0 0 8px${n === 0 ? ";font-weight:600" : ""}">${esc(p)}</p>`).join("")}</td></tr>
<tr><td style="padding:20px 24px 0"><a href="${esc(i.url)}" style="display:inline-block;background:#1F4FD8;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(botao)}</a></td></tr>
<tr><td style="padding:20px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// ── 2.6b-1 Atendimento: a equipe respondeu ──

type AtendimentoCopy = { assunto: string; ola: string; corpo: string; botao: string; rodape: string };

const ATENDIMENTO: Record<EmailLocale, AtendimentoCopy> = {
  "pt-BR": {
    assunto: "A equipe do W2Talent respondeu",
    ola: "Olá",
    corpo: "A equipe do W2Talent respondeu à sua conversa na Ajuda. Abra pelo botão abaixo para ler e continuar.",
    botao: "Ver a resposta",
    rodape: "Você recebe este aviso porque abriu uma conversa na Ajuda do W2Talent. Não compartilhe o link: quem tem o link vê a conversa.",
  },
  en: {
    assunto: "The W2Talent team replied",
    ola: "Hi",
    corpo: "The W2Talent team replied to your conversation in Help. Open it with the button below to read and continue.",
    botao: "See the reply",
    rodape: "You get this notice because you started a conversation in W2Talent Help. Do not share the link: anyone with the link can see the conversation.",
  },
  es: {
    assunto: "El equipo de W2Talent respondió",
    ola: "Hola",
    corpo: "El equipo de W2Talent respondió a tu conversación en Ayuda. Ábrela con el botón de abajo para leer y continuar.",
    botao: "Ver la respuesta",
    rodape: "Recibes este aviso porque abriste una conversación en la Ayuda de W2Talent. No compartas el enlace: quien lo tenga puede ver la conversación.",
  },
};

/** O texto da resposta não vai no e-mail: fica só na conversa, atrás do link. */
export function renderAtendimentoEmail(i: { locale: EmailLocale; url: string }): { subject: string; html: string; text: string } {
  const c = ATENDIMENTO[i.locale];
  const text = `${c.ola},\n\n${c.corpo}\n\n${c.botao}: ${i.url}\n\n${c.rodape}\n`;
  const html = `<!doctype html><html lang="${i.locale}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:24px"><p style="margin:0 0 12px">${esc(c.ola)},</p><p style="margin:0">${esc(c.corpo)}</p></td></tr>
<tr><td style="padding:20px 24px 0"><a href="${esc(i.url)}" style="display:inline-block;background:#1F4FD8;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(c.botao)}</a></td></tr>
<tr><td style="padding:20px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: c.assunto, html, text };
}

// ── 3.4b Integração com ATS pausada: aviso ao dono da empresa (plano 3.4, D5) ──

const WEBHOOK_PAUSADO: Record<
  EmailLocale,
  { assunto: string; ola: (n: string) => string; corpo: (empresa: string, host: string, falhas: number) => string; religar: string; botao: string; rodape: string }
> = {
  "pt-BR": {
    assunto: "Integração com ATS pausada",
    ola: (n) => (n ? `Olá, ${n}` : "Olá"),
    corpo: (e, h, f) =>
      `Pausamos a integração com ATS${e ? ` da empresa ${e}` : ""}: ${f} entregas seguidas${h ? ` para ${h}` : ""} não deram certo. Enquanto ela estiver pausada, nenhum aviso é enviado ao seu sistema.`,
    religar:
      "Para voltar: confira o endereço e o seu sistema, abra Minha empresa > Integração com ATS, use \"Enviar teste\" e clique em Ativar. O que aconteceu durante a pausa não é reenviado.",
    botao: "Abrir Minha empresa",
    rodape: "Você recebe este aviso porque cadastrou a empresa no W2Talent e configurou a integração com ATS.",
  },
  en: {
    assunto: "ATS integration paused",
    ola: (n) => (n ? `Hi ${n}` : "Hi"),
    corpo: (e, h, f) =>
      `We paused the ATS integration${e ? ` for ${e}` : ""}: ${f} deliveries in a row${h ? ` to ${h}` : ""} failed. While it is paused, nothing is sent to your system.`,
    religar:
      "To turn it back on: check the address and your system, open My company > ATS integration, use \"Send test\" and click Turn on. Events from the paused period are not sent again.",
    botao: "Open My company",
    rodape: "You get this notice because you registered the company on W2Talent and set up the ATS integration.",
  },
  es: {
    assunto: "Integración con ATS pausada",
    ola: (n) => (n ? `Hola, ${n}` : "Hola"),
    corpo: (e, h, f) =>
      `Pausamos la integración con ATS${e ? ` de la empresa ${e}` : ""}: ${f} entregas seguidas${h ? ` a ${h}` : ""} fallaron. Mientras esté pausada, no se envía ningún aviso a tu sistema.`,
    religar:
      "Para reactivarla: revisa la dirección y tu sistema, abre Mi empresa > Integración con ATS, usa \"Enviar prueba\" y haz clic en Activar. Lo que pasó durante la pausa no se reenvía.",
    botao: "Abrir Mi empresa",
    rodape: "Recibes este aviso porque registraste la empresa en W2Talent y configuraste la integración con ATS.",
  },
};

export type WebhookPausadoEmailInput = { locale: EmailLocale; nome?: string | null; empresa: string; host: string; falhas: number; url: string };

export function renderWebhookPausadoEmail(i: WebhookPausadoEmailInput): { subject: string; html: string; text: string } {
  const c = WEBHOOK_PAUSADO[i.locale];
  const saudacao = c.ola(primeiroNome(i.nome));
  const corpo = c.corpo(i.empresa, i.host, i.falhas);
  const text = `${saudacao},\n\n${corpo}\n\n${c.religar}\n\n${c.botao}: ${i.url}\n\n${c.rodape}\n`;
  const html = `<!doctype html><html lang="${i.locale}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:24px"><p style="margin:0 0 12px">${esc(saudacao)},</p><p style="margin:0 0 8px;font-weight:600">${esc(corpo)}</p><p style="margin:0">${esc(c.religar)}</p></td></tr>
<tr><td style="padding:20px 24px 0"><a href="${esc(i.url)}" style="display:inline-block;background:#1F4FD8;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(c.botao)}</a></td></tr>
<tr><td style="padding:20px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: c.assunto, html, text };
}

// ── Login com e-mail e senha (plano 2026-11-19, D1/D7/D8) ──

export type LoginEmailTipo = "confirmar" | "redefinir" | "ja_tem_conta" | "senha_trocada";

type LoginCopy = { assunto: string; corpo: string; botao: string; rodape: string };

const LOGIN: Record<EmailLocale, { ola: (n: string) => string } & Record<LoginEmailTipo, LoginCopy>> = {
  "pt-BR": {
    ola: (n) => (n ? `Olá, ${n}` : "Olá"),
    confirmar: {
      assunto: "Confirme seu e-mail no W2Talent",
      corpo: "Para terminar de criar sua conta, confirme seu e-mail no botão abaixo. O link vale 1 hora.",
      botao: "Confirmar e-mail",
      rodape: "Se não foi você que pediu, ignore este e-mail: a conta não é criada sem a confirmação.",
    },
    redefinir: {
      assunto: "Crie uma nova senha no W2Talent",
      corpo: "Recebemos um pedido para criar uma nova senha. Use o botão abaixo; o link vale 1 hora e só funciona uma vez.",
      botao: "Criar nova senha",
      rodape: "Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.",
    },
    ja_tem_conta: {
      assunto: "Você já tem conta no W2Talent",
      corpo: "Alguém tentou criar uma conta com este e-mail, mas ele já tem conta. Para entrar, use o botão abaixo. Se esqueceu a senha, use \"Esqueci a senha\" na tela de entrar.",
      botao: "Entrar",
      rodape: "Se não foi você, ignore este e-mail: nada mudou na sua conta.",
    },
    senha_trocada: {
      assunto: "Sua senha do W2Talent foi trocada",
      corpo: "A senha da sua conta acabou de ser trocada e saímos dos outros aparelhos. Se foi você, não precisa fazer nada.",
      botao: "Não fui eu: criar nova senha",
      rodape: "Se não foi você, crie uma nova senha agora e ligue o autenticador em Minha conta > Segurança.",
    },
  },
  en: {
    ola: (n) => (n ? `Hi ${n}` : "Hi"),
    confirmar: {
      assunto: "Confirm your e-mail on W2Talent",
      corpo: "To finish creating your account, confirm your e-mail with the button below. The link is valid for 1 hour.",
      botao: "Confirm e-mail",
      rodape: "If you didn't ask for this, ignore this e-mail: the account is not created without confirmation.",
    },
    redefinir: {
      assunto: "Create a new W2Talent password",
      corpo: "We got a request to create a new password. Use the button below; the link is valid for 1 hour and works only once.",
      botao: "Create new password",
      rodape: "If you didn't ask for this, ignore this e-mail: your password stays the same.",
    },
    ja_tem_conta: {
      assunto: "You already have a W2Talent account",
      corpo: "Someone tried to create an account with this e-mail, but it already has one. Use the button below to sign in. If you forgot your password, use \"Forgot password\" on the sign-in screen.",
      botao: "Sign in",
      rodape: "If this wasn't you, ignore this e-mail: nothing changed in your account.",
    },
    senha_trocada: {
      assunto: "Your W2Talent password was changed",
      corpo: "Your account password was just changed and we signed you out of other devices. If it was you, there is nothing to do.",
      botao: "Not me: create a new password",
      rodape: "If it wasn't you, create a new password now and turn on the authenticator in My account > Security.",
    },
  },
  es: {
    ola: (n) => (n ? `Hola, ${n}` : "Hola"),
    confirmar: {
      assunto: "Confirma tu correo en W2Talent",
      corpo: "Para terminar de crear tu cuenta, confirma tu correo con el botón de abajo. El enlace vale 1 hora.",
      botao: "Confirmar correo",
      rodape: "Si no lo pediste, ignora este correo: la cuenta no se crea sin la confirmación.",
    },
    redefinir: {
      assunto: "Crea una nueva contraseña en W2Talent",
      corpo: "Recibimos un pedido para crear una nueva contraseña. Usa el botón de abajo; el enlace vale 1 hora y funciona una sola vez.",
      botao: "Crear nueva contraseña",
      rodape: "Si no lo pediste, ignora este correo: tu contraseña sigue igual.",
    },
    ja_tem_conta: {
      assunto: "Ya tienes cuenta en W2Talent",
      corpo: "Alguien intentó crear una cuenta con este correo, pero ya tiene una. Para entrar, usa el botón de abajo. Si olvidaste la contraseña, usa \"Olvidé la contraseña\" en la pantalla de entrar.",
      botao: "Entrar",
      rodape: "Si no fuiste tú, ignora este correo: nada cambió en tu cuenta.",
    },
    senha_trocada: {
      assunto: "Tu contraseña de W2Talent cambió",
      corpo: "La contraseña de tu cuenta acaba de cambiar y cerramos la sesión en los otros dispositivos. Si fuiste tú, no hace falta hacer nada.",
      botao: "No fui yo: crear nueva contraseña",
      rodape: "Si no fuiste tú, crea una nueva contraseña ahora y activa el autenticador en Mi cuenta > Seguridad.",
    },
  },
};

export type LoginEmailInput = { locale: EmailLocale; tipo: LoginEmailTipo; nome?: string | null; url: string };

export function renderLoginEmail(i: LoginEmailInput): { subject: string; html: string; text: string } {
  const base = LOGIN[i.locale];
  const c = base[i.tipo];
  const saudacao = base.ola(primeiroNome(i.nome));
  const botao = c.botao;
  const text = `${saudacao},\n\n${c.corpo}\n\n${botao}: ${i.url}\n\n${c.rodape}\n`;
  const html = `<!doctype html><html lang="${i.locale}"><body style="margin:0;padding:0;background:#F7F8FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px">
<tr><td style="padding:24px 24px 0;font:700 18px 'Space Grotesk',Inter,Arial,sans-serif">W2<span style="color:#1F4FD8">Talent</span></td></tr>
<tr><td style="padding:16px 24px 0;font-size:16px;line-height:24px"><p style="margin:0 0 12px">${esc(saudacao)},</p><p style="margin:0">${esc(c.corpo)}</p></td></tr>
<tr><td style="padding:20px 24px 0"><a href="${esc(i.url)}" style="display:inline-block;background:#1F4FD8;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${esc(botao)}</a></td></tr>
<tr><td style="padding:20px 24px 24px;font-size:13px;line-height:20px;color:#4B5563">${esc(c.rodape)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: c.assunto, html, text };
}
