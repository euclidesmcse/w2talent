/**
 * 2.5a Convite de agenda (.ics, RFC 5545) para os e-mails da entrevista.
 * REQUEST cria ou atualiza o evento (mesmo UID, SEQUENCE maior); CANCEL tira da agenda.
 * Horários sempre em UTC (sufixo Z): cada agenda mostra no fuso de quem abre.
 */

export type ConviteIcs = {
  uid: string;
  sequencia: number;
  metodo: "REQUEST" | "CANCEL";
  inicio: Date;
  fim: Date;
  titulo: string;
  descricao?: string;
  link?: string | null;
  organizador: { nome: string; email: string };
  convidado: { nome: string; email: string };
  agora?: Date;
};

const enc = new TextEncoder();

function data(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Texto de propriedade: \ ; , e quebras de linha escapados. */
export function textoIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Parâmetro entre aspas (CN): sem aspas, quebras ou ; , : soltos. */
function param(s: string): string {
  return `"${s.replace(/["\r\n]/g, " ").trim()}"`;
}

/** Linhas de no máximo 75 bytes, continuação com um espaço (sem quebrar caractere UTF-8). */
export function dobrar(linha: string): string {
  const partes: string[] = [];
  let atual = "";
  let bytes = 0;
  for (const ch of linha) {
    const n = enc.encode(ch).length;
    const limite = partes.length === 0 ? 75 : 74;
    if (bytes + n > limite) {
      partes.push(atual);
      atual = "";
      bytes = 0;
    }
    atual += ch;
    bytes += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

export function gerarIcs(c: ConviteIcs): string {
  const cancel = c.metodo === "CANCEL";
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//W2Talent//Agenda//PT",
    "CALSCALE:GREGORIAN",
    `METHOD:${c.metodo}`,
    "BEGIN:VEVENT",
    `UID:${c.uid}`,
    `SEQUENCE:${c.sequencia}`,
    `DTSTAMP:${data(c.agora ?? new Date())}`,
    `DTSTART:${data(c.inicio)}`,
    `DTEND:${data(c.fim)}`,
    `SUMMARY:${textoIcs(c.titulo)}`,
    ...(c.descricao ? [`DESCRIPTION:${textoIcs(c.descricao)}`] : []),
    ...(c.link ? [`LOCATION:${textoIcs(c.link)}`, `URL:${c.link.replace(/[\r\n]/g, "")}`] : []),
    `ORGANIZER;CN=${param(c.organizador.nome)}:mailto:${c.organizador.email}`,
    `ATTENDEE;CN=${param(c.convidado.nome)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${c.convidado.email}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    ...(cancel ? [] : ["BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${textoIcs(c.titulo)}`, "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}

/** Base64 de texto UTF-8 (anexo do e-mail), sem Buffer: roda no Worker e no Node. */
export function base64Utf8(s: string): string {
  let bin = "";
  for (const b of enc.encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}
