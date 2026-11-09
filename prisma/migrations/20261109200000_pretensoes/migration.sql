-- Pretensão por regime: uma lista com o mínimo aceito em cada regime marcado.
ALTER TABLE "CandidateProfile" ADD COLUMN "pretensoes" JSONB NOT NULL DEFAULT '[]';

-- Perfis com o valor único de antes: vira a pretensão mensal do primeiro regime marcado
-- (ou CLT, se nenhum), usando o menor valor informado como mínimo.
UPDATE "CandidateProfile"
SET "pretensoes" = jsonb_build_array(jsonb_build_object(
  'regime', coalesce("regimePreferido"[1], 'CLT'),
  'valor', least(coalesce("pretensaoDe", "pretensaoAte"), coalesce("pretensaoAte", "pretensaoDe")),
  'unidade', 'mes',
  'moeda', coalesce("pretensaoMoeda", 'BRL')
))
WHERE "pretensaoDe" IS NOT NULL OR "pretensaoAte" IS NOT NULL;
