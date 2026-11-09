// Step 1 TDD — deve FALHAR antes da implementação
import { normalizeSkill } from "../lib/taxonomy";

// These imports will fail until lib/cv-extract.ts exists
import {
  extractToCanonical,
  validateForPublish,
  buildTsvectorText,
  publishDraft,
  extractSkillsFromText,
  FALLBACK_WARNING,
  MIN_TEXT_LENGTH,
  emptyDraft,
} from "../lib/cv-extract";

import * as fs from "fs";
import * as path from "path";

describe("CV Canônico — Ingestão PDF/DOCX/LinkedIn + IA Extração + Preview 1 Tela (Task 3)", () => {
  // raw texto simulando conteúdo extraído de PDF com texto
  const pdfText = `
João da Silva — Engenheiro Cloud Pleno
São Paulo, remoto • joao@email.com • +55 11 99999-9999
Resumo: 5 anos com AWS, Docker, Kubernetes e React. Liderou migração para EKS.
Objetivo: Quero crescer para Tech Lead em Cloud/DevOps liderando times e arquitetura.
Skills: AWS, React, Node.js, Docker, Kubernetes, PostgreSQL
Experiência: Empresa X — Engenheiro Cloud (2020-2025) — migração AWS
Formação: Sistemas de Informação — USP
`;

  describe("1. upload PDF com texto extrai titulo, top3 skills normalizadas, objetivoCrescimento obrigatório senão 400", () => {
    it("extrai titulo e top3 skills normalizadas via taxonomia", async () => {
      const result = await extractToCanonical(pdfText, {
        consent: { iaReescritaV: true },
      });
      expect(result.fallback).toBeFalsy();
      const draft = result.draft;
      expect(draft.titulo).toBeTruthy();
      // titulo deve conter Cloud ou Engenheiro
      expect(draft.titulo.toLowerCase()).toMatch(/cloud|engenheiro/);
      expect(Array.isArray(draft.stack)).toBe(true);
      expect(draft.stack.length).toBeGreaterThanOrEqual(3);
      // top 3 devem ser normalizados (aws, react, etc)
      const top3 = draft.stack.slice(0, 3).map((s: any) => s.skillId);
      expect(top3).toContain("aws");
      // skills normalizadas devem resolver via taxonomy
      for (const item of draft.stack.slice(0, 3)) {
        expect(normalizeSkill(item.skillId)).toBeTruthy();
      }
      // raw skills extraídas devem usar normalizeSkill (sinônimo)
      const extracted = extractSkillsFromText("Trabalhei com Amazon Web Services e React.js e .NET");
      expect(extracted).toContain("aws");
      expect(extracted).toContain("react");
      expect(extracted).toContain("dotnet");
    });

    it("objetivoCrescimento obrigatório — validateForPublish lança 400 se ausente", async () => {
      const result = await extractToCanonical(pdfText.replace(/Objetivo:[\s\S]*/, ""), {
        consent: { iaReescritaV: true },
      });
      // draft sem objetivoCrescimento
      const draftSemObjetivo = { ...result.draft, objetivoCrescimento: "" };
      expect(() => validateForPublish(draftSemObjetivo)).toThrow();
      let err: any;
      try {
        validateForPublish(draftSemObjetivo);
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.status ?? err.statusCode).toBe(400);
      expect(err.message).toMatch(/objetivo/i);

      // com objetivo deve passar
      const draftOk = { ...result.draft, objetivoCrescimento: "Quero evoluir para Tech Lead" };
      expect(() => validateForPublish(draftOk)).not.toThrow();
    });

    it("publishDraft valida objetivoCrescimento (400 sem, 200 com)", async () => {
      const result = await extractToCanonical(pdfText, { consent: { iaReescritaV: true } });
      const semObjetivo = { ...result.draft, objetivoCrescimento: "" };
      await expect(publishDraft(semObjetivo as any)).rejects.toMatchObject({ status: 400 });
      const comObjetivo = { ...result.draft, objetivoCrescimento: "Crescer para liderança técnica" };
      // should not throw validation, embedding will be generated
      const published = await publishDraft(comObjetivo as any);
      expect(published).toBeDefined();
      expect(published.draft.objetivoCrescimento).toBeTruthy();
    });
  });

  describe("2. PDF escaneado sem texto -> fallback form em branco com aviso (Review Focus 1)", () => {
    it("texto vazio ou muito curto retorna fallback true + aviso + draft vazio", async () => {
      const vazio = await extractToCanonical("", { consent: { iaReescritaV: true } });
      expect(vazio.fallback).toBe(true);
      expect(vazio.warning).toMatch(/não foi possível extrair/i);
      expect(vazio.draft).toBeDefined();
      expect(vazio.draft.titulo).toBeFalsy(); // form em branco
      expect(vazio.draft.stack.length).toBe(0);

      const escaneado = await extractToCanonical("   \n\n  ", { consent: { iaReescritaV: true } });
      expect(escaneado.fallback).toBe(true);

      const curto = await extractToCanonical("img", { consent: { iaReescritaV: true } });
      expect(curto.fallback).toBe(true);
      expect(curto.warning).toBe(FALLBACK_WARNING);

      // constante documentada
      expect(typeof MIN_TEXT_LENGTH).toBe("number");
      expect(MIN_TEXT_LENGTH).toBeGreaterThan(10);

      // emptyDraft helper gera form em branco válido
      const blank = emptyDraft();
      expect(blank.titulo).toBe("");
      expect(blank.stack).toEqual([]);
      expect(blank.objetivoCrescimento).toBe("");
    });

    it("lib/cv-extract expõe FALLBACK_WARNING correto", async () => {
      expect(FALLBACK_WARNING.toLowerCase()).toMatch(/não foi possível extrair|preencha manual/);
    });
  });

  describe("3. preview editável permite corrigir skill antes de publicar; publish cria pgvector embedding + tsvector", () => {
    it("preview: draft editável — corrigir skill e objetivo antes de publish", async () => {
      const result = await extractToCanonical(pdfText, { consent: { iaReescritaV: true } });
      const draft = result.draft;
      // simula edição no preview: trocar primeira skill errada por kubernetes
      const edited = {
        ...draft,
        stack: [{ skillId: "kubernetes", nivel: "avancado", anos: 3 }, ...draft.stack.slice(1)],
        objetivoCrescimento: draft.objetivoCrescimento || "Quero crescer para liderança",
      };
      expect(edited.stack[0].skillId).toBe("kubernetes");
      // deve validar após edição
      expect(() => validateForPublish(edited as any)).not.toThrow();

      // skill corrigida deve persistir no publish
      const published = await publishDraft(edited as any);
      expect(published.draft.stack[0].skillId).toBe("kubernetes");
    });

    it("publish monta o tsvector na hora; o vetor (bge-m3) vem depois, em segundo plano (1.5.9)", async () => {
      const result = await extractToCanonical(pdfText, { consent: { iaReescritaV: true } });
      const draft = { ...result.draft, objetivoCrescimento: "Crescer como Tech Lead Cloud" };
      const published = await publishDraft(draft as any);
      // o vetor não sai mais na resposta: lib/indexing.ts grava no banco
      expect((published as any).embedding).toBeUndefined();
      // tsvector text gerado
      expect(typeof published.tsvector).toBe("string");
      expect(published.tsvector.length).toBeGreaterThan(10);
      expect(published.tsvector.toLowerCase()).toMatch(/cloud|aws|react/);

      // buildTsvectorText helper direto
      const tv = buildTsvectorText(draft as any);
      expect(tv.length).toBeGreaterThan(10);
      expect(tv.toLowerCase()).toMatch(/aws|cloud/);
    });

    it("componente cv-preview-form.tsx existe e é 1 tela editável", () => {
      const compPath = path.join(__dirname, "../components/cv-preview-form.tsx");
      expect(fs.existsSync(compPath)).toBe(true);
      const src = fs.readFileSync(compPath, "utf-8");
      // deve conter campos editáveis e objetivoCrescimento obrigatório
      expect(src).toMatch(/objetivoCrescimento/i);
      expect(src).toMatch(/titulo/i);
      expect(src).toMatch(/stack|skill/i);
      // deve ter submit/publicar
      expect(src).toMatch(/publicar|salvar|ativo/i);
      // preview 1 tela — sem navegação multi-step
      expect(src).toMatch(/CvPreviewForm|CVPreview/i);
    });

    it("routes existem: POST /api/candidates/ingest e PUT /api/candidates/:id", () => {
      const ingestRoute = path.join(__dirname, "../app/api/candidates/route.ts");
      const publishRoute = path.join(__dirname, "../app/api/candidates/[id]/route.ts");
      expect(fs.existsSync(ingestRoute)).toBe(true);
      expect(fs.existsSync(publishRoute)).toBe(true);
      const ingestSrc = fs.readFileSync(ingestRoute, "utf-8");
      expect(ingestSrc).toMatch(/ingest|extractToCanonical/i);
      expect(ingestSrc).toMatch(/iaReescrita/i);
      const publishSrc = fs.readFileSync(publishRoute, "utf-8");
      expect(publishSrc).toMatch(/publish|validateForPublish|generateEmbedding|tsvector/i);
    });
  });

  describe("4. LGPD iaReescritaV consent obrigatório para extração", () => {
    it("sem iaReescritaV true lança 400/403", async () => {
      await expect(extractToCanonical(pdfText, { consent: { iaReescritaV: false } as any })).rejects.toMatchObject({
        message: expect.stringMatching(/iaReescrita/i),
      });
      let err: any;
      try {
        await extractToCanonical(pdfText, { consent: { iaReescritaV: false } as any });
      } catch (e: any) {
        err = e;
      }
      expect([400, 403].includes(err.status ?? err.statusCode)).toBe(true);

      // sem consent objeto inteiro também deve falhar
      await expect(extractToCanonical(pdfText, {} as any)).rejects.toMatchObject({
        message: expect.stringMatching(/iaReescrita|consent/i),
      });
      await expect(extractToCanonical(pdfText, { consent: undefined } as any)).rejects.toThrow();
    });

    it("com iaReescritaV true permite extração", async () => {
      const result = await extractToCanonical(pdfText, { consent: { iaReescritaV: true } });
      expect(result.draft).toBeDefined();
      expect(result.fallback).toBeFalsy();
    });

    it("route ingest valida consent — fonte deve checar LGPD", () => {
      const ingestPath = path.join(__dirname, "../app/api/candidates/route.ts");
      const src = fs.readFileSync(ingestPath, "utf-8");
      expect(src).toMatch(/iaReescritaV|iaReescrita/);
      expect(src).toMatch(/400|403/);
    });
  });
});

describe("extractSkillsFromText não inventa competências", () => {
  it("palavras comuns e pedaços de outros nomes não viram skill", () => {
    const texto =
      "Rua das Flores, Rés-do-Chão. Whatsapp +351. Soluções Azure e AWS com PowerShell e GitHub Actions. " +
      "Apoio consultivo, Zero Trust, Private Link, Recovery Services Vault, Elastic Beanstalk, Windows 2012 R2, " +
      "microsegmentação, guardrails, relatórios, players da AWS, ExpressRoute, monólitos, nesta etapa, Microsoft Foundry.";
    const ids = extractSkillsFromText(texto);
    for (const falso of ["sap", "digitalocean", "ant", "solana", "git", "shell", "consul", "rust", "chainlink", "vault",
      "elasticsearch", "cloudflare-r2", "segment", "rails", "ios-native", "play-framework", "express", "lit", "nestjs", "cardano"]) {
      expect(ids).not.toContain(falso);
    }
    expect(ids).toEqual(expect.arrayContaining(["azure", "aws", "powershell", "github-actions"]));
  });

  it("nomes ambíguos contam escritos como a tecnologia", () => {
    expect(extractSkillsFromText("Consultor SAP e Swift para iOS")).toEqual(expect.arrayContaining(["sap", "swift", "ios-native"]));
    expect(extractSkillsFromText("o sap da árvore, swift ruby")).not.toEqual(expect.arrayContaining(["sap"]));
    expect(extractSkillsFromText("Golang, C++ e C# no backend")).toEqual(expect.arrayContaining(["go", "cpp", "csharp"]));
  });
});
