import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buttonClasses, Card, Chip, MatchBar, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PASSOS = [
  { n: "1", titulo: "Busque do seu jeito", texto: "Escreva como falaria: “DevOps remoto PJ 15 mil”. A IA mostra o que entendeu e você ajusta." },
  { n: "2", titulo: "Abra e confira", texto: "Cada vaga mostra o match com o seu perfil e o que falta, antes de você decidir." },
  { n: "3", titulo: "Aprove uma por uma", texto: "Só entra no envio o que você aprovou. Se a vaga mudar depois, a aprovação cai." },
  { n: "4", titulo: "Envie em lote", texto: "Até 10 por envio e 30 por dia. Vaga enviada fica marcada e não é enviada de novo." },
];

const PERGUNTAS = [
  { p: "Preciso pagar para me candidatar?", r: "Não. Candidatos usam de graça." },
  { p: "Meu telefone e e-mail ficam expostos?", r: "Não. O contato fica protegido até você responder a uma empresa." },
  { p: "Funciona no celular?", r: "Sim. A mesma conta funciona no computador e no celular, e dá para instalar como app." },
  { p: "O w2talent.com já está no ar?", r: "Ainda não. Esta é a versão de testes, que muda com frequência." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <AppHeader
        nav={[
          { href: "/vagas", label: "Vagas" },
          { href: "/candidatos", label: "Para recrutadores" },
        ]}
        right={
          <Link href="/vagas" className={buttonClasses("primary", "sm", "hover:no-underline hover:text-white")}>
            Ver vagas
          </Link>
        }
      />

      <main className="mx-auto flex max-w-page flex-col gap-16 px-6 py-12 md:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5">
            <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[40px]">
              Candidate-se a várias vagas de uma vez, sem perder o controle.
            </h1>
            <p className="max-w-[56ch] text-[17px] text-muted">
              Você encontra as vagas, confere cada uma e aprova. O W2Talent envia em lote só as que você aprovou, com um
              resumo do seu perfil que o recrutador entende em segundos.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/vagas" className={buttonClasses("primary", "lg", "hover:no-underline hover:text-white")}>
                Buscar vagas
              </Link>
              <Link href="/candidatos" className={buttonClasses("secondary", "lg", "hover:no-underline")}>
                Sou recrutador
              </Link>
            </div>
          </div>

          {/* Amostra do produto, no visual do protótipo */}
          <Card className="flex flex-col gap-4 p-5" aria-label="Exemplo de busca">
            <div className="flex h-10 items-center rounded-control border border-line-strong px-3 text-[15px]">DevOps remoto PJ 15k</div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              A IA entendeu:
              <Chip>DevOps</Chip>
              <Chip>Remoto</Chip>
              <Chip>PJ</Chip>
              <Chip>≥ R$ 15 mil</Chip>
            </div>
            {[
              { t: "DevOps Sênior", e: "Remoto · PJ · R$ 16–20 mil", m: 87, s: "aprovada" as const },
              { t: "SRE Pleno", e: "Remoto · PJ · R$ 14–17 mil", m: 74, s: "revisada" as const },
              { t: "Platform Engineer", e: "Remoto · CLT · R$ 15–19 mil", m: 69, s: "enviada" as const },
            ].map((v) => (
              <div key={v.t} className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-3">
                <div className="min-w-[160px] flex-1">
                  <div className="font-semibold">{v.t}</div>
                  <div className="text-[13px] text-muted">{v.e}</div>
                </div>
                <MatchBar value={v.m} />
                <StatusBadge status={v.s}>{v.s === "enviada" ? "Enviada 08/11" : undefined}</StatusBadge>
              </div>
            ))}
          </Card>
        </section>

        <section aria-labelledby="como-funciona" className="flex flex-col gap-5">
          <h2 id="como-funciona" className="text-xl font-semibold">
            Como funciona
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p) => (
              <li key={p.n}>
                <Card className="flex h-full flex-col gap-2 p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-ink">
                    {p.n}
                  </span>
                  <strong className="font-semibold">{p.titulo}</strong>
                  <span className="text-sm text-muted">{p.texto}</span>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="recrutadores" className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 id="recrutadores" className="text-xl font-semibold">
              Para recrutadores
            </h2>
            <p className="text-muted">
              Candidatos chegam com a Ficha W2: um resumo padronizado, com os campos mínimos preenchidos e o match explicado.
              Publique a vaga colando o texto; a IA organiza os campos e avisa se ela já existe.
            </p>
            <div>
              <Link href="/candidatos" className={buttonClasses("secondary", "md", "hover:no-underline")}>
                Ver candidatos
              </Link>
            </div>
          </div>
          <Card className="p-5">
            <dl className="flex flex-col divide-y divide-line-soft text-sm">
              {PERGUNTAS.map((q) => (
                <div key={q.p} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <dt className="font-semibold">{q.p}</dt>
                  <dd className="text-muted">{q.r}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-page flex-wrap justify-between gap-2 px-6 py-5 text-[13px] text-muted">
          <span>W2Talent · versão de testes</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
