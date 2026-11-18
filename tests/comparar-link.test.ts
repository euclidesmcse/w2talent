/** 2.3 Link da comparação: token assinado (HMAC-SHA256), 14 dias, sem adulteração. */
import { assinarLinkComparacao, COMPARAR_LINK_DIAS, lerLinkComparacao } from "../lib/comparar-link";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";
const AGORA = Date.UTC(2026, 10, 18, 12);
const DIA = 86_400_000;

const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("link da comparação", () => {
  it("assina e lê de volta: empresa, ids na ordem, vaga, criação e validade de 14 dias", async () => {
    const { token, expira } = await assinarLinkComparacao({ empresa: "emp1", ids: ["c2", "c1"], vaga: "v1" }, SEGREDO, AGORA);
    expect(COMPARAR_LINK_DIAS).toBe(14);
    expect(expira.getTime()).toBe(AGORA + 14 * DIA);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(await lerLinkComparacao(token, SEGREDO, AGORA + DIA)).toEqual({
      ok: true,
      conteudo: { empresa: "emp1", ids: ["c2", "c1"], vaga: "v1", criado: AGORA, expira: AGORA + 14 * DIA },
    });
  });

  it("sem vaga, vaga vem null", async () => {
    const { token } = await assinarLinkComparacao({ empresa: "emp1", ids: ["c1"] }, SEGREDO, AGORA);
    const r = await lerLinkComparacao(token, SEGREDO, AGORA);
    expect(r.ok && r.conteudo.vaga).toBeNull();
  });

  it("vence depois de 14 dias", async () => {
    const { token } = await assinarLinkComparacao({ empresa: "emp1", ids: ["c1"] }, SEGREDO, AGORA);
    expect((await lerLinkComparacao(token, SEGREDO, AGORA + 14 * DIA)).ok).toBe(true);
    expect(await lerLinkComparacao(token, SEGREDO, AGORA + 14 * DIA + 1)).toEqual({ ok: false, erro: "link_vencido" });
  });

  it("recusa token adulterado, de outro segredo ou malformado", async () => {
    const { token } = await assinarLinkComparacao({ empresa: "emp1", ids: ["c1"] }, SEGREDO, AGORA);
    const [corpo, sig] = token.split(".");
    const invalido = { ok: false, erro: "link_invalido" };
    // Troca a empresa (e estica a validade) mantendo a assinatura antiga.
    const outro = b64(JSON.stringify({ v: 1, e: "emp2", i: ["c1", "c9"], c: AGORA, x: AGORA + 365 * DIA }));
    expect(await lerLinkComparacao(`${outro}.${sig}`, SEGREDO, AGORA)).toEqual(invalido);
    // Assinatura com um caractere trocado.
    const trocada = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(await lerLinkComparacao(`${corpo}.${trocada}`, SEGREDO, AGORA)).toEqual(invalido);
    expect(await lerLinkComparacao(token, "outro-segredo-com-mais-de-32-caracteres!!", AGORA)).toEqual(invalido);
    for (const ruim of [null, undefined, 42, "", "abc", `${corpo}.${sig}.x`, `${corpo}.!!`, "a".repeat(5000)]) {
      expect(await lerLinkComparacao(ruim, SEGREDO, AGORA)).toEqual(invalido);
    }
    expect(await lerLinkComparacao(token, "", AGORA)).toEqual(invalido);
  });

  it("o vencido só é dito com a assinatura certa (link forjado vencido continua inválido)", async () => {
    const velho = b64(JSON.stringify({ v: 1, e: "emp1", i: ["c1"], c: 0, x: 1 }));
    expect(await lerLinkComparacao(`${velho}.AAAA`, SEGREDO, AGORA)).toEqual({ ok: false, erro: "link_invalido" });
  });

  it("não assina lista vazia, com mais de 10 ou sem empresa", async () => {
    await expect(assinarLinkComparacao({ empresa: "emp1", ids: [] }, SEGREDO)).rejects.toThrow();
    await expect(assinarLinkComparacao({ empresa: "emp1", ids: Array.from({ length: 11 }, (_, i) => `c${i}`) }, SEGREDO)).rejects.toThrow();
    await expect(assinarLinkComparacao({ empresa: "", ids: ["c1"] }, SEGREDO)).rejects.toThrow();
    await expect(assinarLinkComparacao({ empresa: "emp1", ids: ["c1"] }, "")).rejects.toThrow();
  });
});
