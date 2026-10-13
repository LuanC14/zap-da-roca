@AGENTS.md

# Claude Code — modo de trabalho neste projeto

O dono delegou a implementação ponta a ponta. Fale em **português (pt-BR)**, de forma curta e direta; entregue resultado, não plano.

## Início de sessão
1. `git status` e `git log --oneline -5`; leia **Status** e **Decisões** em `AGENTS.md`.
2. Se mexeu em produção recentemente: `npm run smoke` (somente leitura) para saber o estado real antes de afirmar qualquer coisa.
3. Consulte a memória (`MEMORY.md`) — mas verifique contra o código/estado atual antes de agir sobre ela.

## Durante o trabalho
- Siga o fluxo de **Entrega e rastreabilidade** do `AGENTS.md`. Gate: `typecheck` + `lint` + `test` (+ `build` para UI/rotas/config).
- Antes de mexer em Next.js, leia o guia correspondente em `node_modules/next/dist/docs/` (versão com mudanças incompatíveis).
- Segurança é regra de produto: respeite os **Invariantes**. Para toda correção de segurança, prove com mutação que o teste falha sem o guard.
- Validação real > suposição: prefira rodar (smoke, rls:check, dry-run do provision) a presumir.
- Windows: o shell principal é PowerShell, Bash também existe. Não há `gh` nem `vercel` instalados — use a API REST pública do GitHub (repo público) e `scripts/provision.mjs`.
- O harness (classificador de segurança) bloqueia mutações de produção e escrita em cofres de segredos. Não tente contornar: pare, explique e entregue o comando exato ao dono.

## Fim de sessão
- Atualize **Status** e **Decisões** no `AGENTS.md` (datas absolutas) e a memória do projeto se algo durável mudou.
- Commit + push só com os gates verdes; depois confira o CI e o smoke (`smoke.yml`) e relate o resultado.
- Resumo final: o que mudou, o que falta e **o que depende do dono** (lista objetiva).
