<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Zap da Roça — guia para agentes

SaaS multi-tenant de gestão financeira e de mão de obra para produtores rurais. O produtor lança despesas, receitas e ponto
**pelo WhatsApp** (bot `!pagar`, `!ponto`…) e acompanha tudo no **painel web**. Assinatura mensal via Mercado Pago, 7 dias de teste.
Idioma do produto e da conversa com o dono: **português (pt-BR)**. Código e comentários: inglês.

## Stack e comandos

Next.js 16 (App Router, `src/proxy.ts` no lugar de middleware) · React 19 · Supabase (Postgres + Auth + RLS) · Tailwind 4 / shadcn · Vitest.
Produção: Vercel (`zap-da-roca`, domínio canônico `https://zapdaroca.com.br`) + Supabase Cloud (ref `eroyhtdcfmffpyjpohke`) + GitHub Actions.

| Comando | Para quê |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm test` | Gate obrigatório antes de qualquer commit |
| `npm run build` | Obrigatório quando mexer em páginas, proxy, config ou componentes cliente |
| `npm run db:start` / `db:reset` | Supabase local (precisa de Docker Desktop ligado) |
| `npm run smoke` | Verificação **somente leitura** da produção (15 checagens) |
| `npm run rls:check` | Isolamento entre tenants contra um Supabase real (cria e apaga 2 usuários temporários) |
| `npm run provision` | Provisionamento (Vercel env, domínio, Supabase Auth). **Simulação por padrão**; `-- --apply` executa |
| `node scripts/test-bot.js "!saldo"` | Envia um comando ao webhook local (dev) |

## Mapa do código

- `src/app/app/**` — painel (protegido por `layout.tsx` + `proxy.ts`). Páginas leem com o **cliente da sessão** (RLS).
- `src/app/api/whatsapp/webhook/{route,handler}.ts` — bot. `route` valida assinatura e deduplica; `handler` executa comandos.
- `src/app/api/cron/route.ts` — lembrete diário 08:00 BRT (`vercel.json`). `src/app/api/pagamento/webhook/route.ts` — Mercado Pago.
- `src/lib/access.ts` — **única** regra de "tem acesso?" (`hasAccess`). `src/lib/tenant.ts` — `requireTenant()` para server actions.
- `src/lib/security.ts` — comparações em tempo constante e assinatura do Mercado Pago. `src/lib/whatsapp.ts` — envio (texto/template) e assinatura da Meta.
- `src/lib/parsers/*` — comandos, datas (fuso `America/Sao_Paulo`), valores pt-BR, correspondência sem acento de categoria/funcionário.
- `supabase/migrations/*` — schema + RLS. `supabase/tests/database/*.sql` — pgTAP. `src/test/fake-supabase.ts` — banco falso dos testes.

## Invariantes — nunca quebre

1. **Isolamento de tenant.** Toda leitura/escrita de dados de cliente é filtrada por `user_id`. Páginas e server actions usam o cliente da
   sessão (RLS). `supabaseAdmin` (service role, ignora RLS) só em webhooks/cron/OTP/billing e **sempre** com `.eq('user_id', …)` explícito.
2. **Colunas de cobrança são só do servidor.** `profiles.subscription_*`, `trial_ends_at`, `current_period_end`, `is_admin` não são graváveis pelo
   usuário (REVOKE/GRANT por coluna). `registered_phones` só se grava pelo fluxo de OTP (service role).
3. **Falhar fechado.** Cron, webhook do WhatsApp e do Mercado Pago recusam tudo quando o segredo não está configurado.
4. **Acesso = `hasAccess()`** — site, bot e cron. Não crie outra regra. Admin (`is_admin`) sempre passa; plano cancelado vale até `current_period_end`.
5. **Server actions são endpoints públicos.** Identidade vem da sessão (`requireTenant`), nunca de campos do formulário.
6. **Segredos nunca vão para o git, para o chat nem para logs.** `.env.local` e `.env.deploy` são ignorados. Tokens só em memória do processo.
7. **Migrations** são idempotentes e **rodam em produção no push para `main`**. Nada destrutivo (drop/rename com dados) sem aprovação do dono.
8. **Dinheiro:** valores pt-BR (`1.500,00`), sempre > 0, `numeric(12,2)`; datas no fuso do Brasil; texto do usuário é guardado como digitado
   (normalização só para comparar).

## Política de testes

- Todo bug corrigido ganha teste de regressão. Toda regra de segurança ganha teste que **quebra** se a regra for removida
  (valide fazendo a mutação: remova o guard, veja o teste falhar, restaure).
- O banco falso **não aplica RLS nem defaults**: o isolamento no nível do banco é provado por pgTAP (CI) e por `npm run rls:check`.
- Mudou algo visual ou de rota? `npm run build` e, se possível, abra no navegador (`preview_start zaprural-dev`).
- Vitest: use `vi.stubEnv(k, undefined)` para simular variável ausente (string vazia é outro caso).

## Entrega e rastreabilidade

- Commits no padrão `feat|fix|chore|ci|test|docs(escopo): resumo` + corpo explicando o **porquê**. Rodapé de coautoria conforme o sistema.
- Fluxo: alterar → `typecheck` + `lint` + `test` (+ `build`) → commit → push em `main` → conferir o CI → `npm run smoke`.
  CI: `check` (lint/types/testes) **bloqueia** `migrate` (supabase db push); `db-test` (pgTAP) roda em paralelo. A Vercel faz deploy
  independente do GitHub Actions, então o código pode entrar antes da migration: migration sempre retrocompatível com o código anterior.
- Ver o CI sem `gh` (repo público): `curl -s "https://api.github.com/repos/LuanC14/zap-da-roca/actions/runs?per_page=5"`.
- `smoke.yml` roda após cada deploy de produção e a cada 6 h. Falhou? Trate como incidente antes de continuar.
- Ao fim de cada sessão: atualize **Status** e **Decisões** abaixo (data absoluta).

## Autonomia

O dono delegou a sequência de implementação. **Pode fazer sem perguntar:** editar código, criar testes e scripts, rodar os gates, commitar e dar push em `main`
quando tudo estiver verde e a migration for aditiva, ler produção em modo somente leitura (`smoke`, `provision` sem `--apply`), corrigir o que o smoke/CI apontar.
**Pergunte antes de:** migration destrutiva, apagar/rotacionar chaves e tokens, gastar dinheiro, enviar mensagens a usuários reais, virar chave do Mercado Pago/Meta
para produção, force-push.
O harness pode bloquear mutações de produção (deploy, escrita em cofre de segredos). Se bloquear, **não contorne**: entregue o comando exato ao dono.

## Go-live — Mercado Pago (pendente: aprovação do app em produção)

1. Credenciais **de produção** → Vercel `MP_ACCESS_TOKEN`; remover `MP_TEST_PAYER_EMAIL` (o smoke e o `provision` apontam se existir).
2. Painel MP → Webhooks: URL `https://zapdaroca.com.br/api/pagamento/webhook`, evento `subscription_preapproval`; copiar a **chave secreta** → `MP_WEBHOOK_SECRET`.
3. Redeploy (`npm run provision -- --apply --only=redeploy`) e `npm run smoke` (o webhook deixa de responder 503 e passa a 401 sem assinatura).
4. Teste real: assinar com valor mínimo, ver `subscription_status = active` em `profiles`, cancelar em Configurações e conferir o cancelamento no MP.

## Go-live — WhatsApp Business (pendente: número próprio + templates)

1. Meta Business verificado, número Business próprio, **token permanente** de usuário do sistema (o temporário expira em ~24 h).
2. Variáveis na Vercel: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.
3. Webhook na Meta: `https://zapdaroca.com.br/api/whatsapp/webhook`, campo `messages`.
4. Templates (pt_BR) — mensagens que o app inicia **exigem** template aprovado; respostas a comandos do usuário (janela de 24 h) usam texto livre:
   - **Autenticação** `zapdaroca_codigo` (código com botão "copiar código", validade 10 min) → `WHATSAPP_TEMPLATE_OTP=zapdaroca_codigo`.
   - **Utilidade** `zapdaroca_lembrete`: `☀️ Bom dia! Contas para hoje ({{1}}): {{2}}. Total: {{3}}. Responda !pago <id> para quitar.` → `WHATSAPP_TEMPLATE_REMINDER=zapdaroca_lembrete`.
   - Idioma diferente de pt_BR → `WHATSAPP_TEMPLATE_LANG`. Sem as variáveis de template o app envia texto (serve só para o número de teste).
5. Teste: vincular o número em Configurações (recebe o código), `!ajuda`, `!pagar 10 diesel teste`, `!saldo`; conferir o lembrete das 08:00 no dia seguinte.

## Status (atualizado em 2026-10-12)

**Pronto:** recuperação de senha (`/esqueci-senha` → e-mail → `/auth/callback?next=/redefinir-senha` → `/redefinir-senha`) · isolamento de tenant e hardening de RLS/billing (em produção, `rls:check` 20/20) · fail-closed em cron/webhooks · OTP com limites · bot corrigido
(valores pt-BR, acentos, fuso, deduplicação) · cadastro de funcionários e categorias · financeiro com totais corretos e filtros · CI com gate + pgTAP verde ·
smoke e provisionamento · domínio canônico apex · SMTP do Supabase via Resend (domínio verificado) · envio por template pronto (ativa por variável).

**Bloqueado no dono:** aprovação do app no Mercado Pago · número WhatsApp Business + templates na Meta · apagar a chave antiga `zapdaroca` no painel do Resend ·
trocar a senha do admin e revogar tokens compartilhados no chat.

**Próximo (quando destravar):** executar os checklists de go-live acima.

## Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-10-08 | Páginas do painel usam o cliente da sessão, não o service role | O service role ignorava RLS e expunha dados entre clientes |
| 2026-10-08 | `profiles` com GRANT por coluna | Usuário podia se autopromover a assinante/admin |
| 2026-10-08 | Gate de acesso fora do `proxy.ts`, em `hasAccess()` no layout/bot/cron | Docs do Next: proxy não deve consultar banco; havia duas regras divergentes |
| 2026-10-12 | Desativar funcionário em vez de excluir | Excluir apagaria o histórico de ponto por cascata |
| 2026-10-12 | Apex `zapdaroca.com.br` canônico, `www` redireciona (308) | Site URL do Supabase e `NEXT_PUBLIC_APP_URL` já usavam o apex |
| 2026-10-12 | `/auth/callback` aceita `next` só por allow-list (`safeNext`) | Evita open redirect em links de e-mail; recuperação de senha precisa pousar em `/redefinir-senha` |
| 2026-10-12 | Mensagens iniciadas pelo app via template (por variável de ambiente) | A Meta só entrega texto livre dentro da janela de 24 h |

## Armadilhas já encontradas

- Windows + Node 24: `process.exit()` logo após `fetch` derruba o processo (`UV_HANDLE_CLOSING`); use `process.exitCode`.
- Em scripts Python/heredoc, `\n` vira quebra de linha real dentro de strings JS — escreva o arquivo com a ferramenta de escrita.
- PostgREST limita 1000 linhas por consulta (`max_rows`).
- Preview do navegador do app pode falhar em screenshot com a janela minimizada: use `get_page_text`.
