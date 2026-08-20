feat(qwenbridge): merge upstream 96c3832, parallel escape e blindagens dodo

- **Merge Upstream (96c3832):** Sincronização oficial com upstream `johngbl/QwenBridge` (9b61572..96c3832), incorporando *Parallel Escape* (`getNextFreeAccountForParallel`) para turnos auxiliares/paralelos sem travar em contas busy por 18s.
- **WAF Baxia & Completion Headers:** Remoção do direct-fetch para completions (bloqueado pelo WAF Baxia por TLS/HTTP stack fingerprinting) e canalização 100% pelo browser relay com `buildCompletionHeaders` (injetando `bx-ua`/`bx-umidtoken`), mantendo `settings/update` (personalization) em Node fetch direto.
- **Preservação Integral do Manifesto Dodo:** Preservadas todas as 14 blindagens Dodo (Dashboard Tauri `/metrics/accounts`, minimização CDP `minimizeWindow`, posicionamento de janelas com offsets `LAUNCHER_WINDOW_X/Y`, `PLAYWRIGHT_HEADLESS=false`, micro-buffering SSE 128B/10ms, porta padrão 50002, script `start:qwenbridge`, resiliência no `page.focus` com 5s timeout, expurgo de contas fantasmas no SQLite `DELETE FROM accounts`, sub-aplicação Anthropic `/v1/messages`, aliases `[1M]`, e SQLite cache 8MB com migração de `qwenbridge.db`).
- **Qualidade & Testes:** TypeScript typecheck concluído com 0 erros e suíte completa de mock com 100% de sucesso (540/540 testes passando).

