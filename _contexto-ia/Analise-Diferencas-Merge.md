# Relatório de Análise de Diferenças - Merge Dodo (Upstream v1.5.0)

## A) O que mudou no Upstream
A versão avançou massivamente para **v1.5.0**. Principais mudanças:
- **Autenticação e Sessão**: Rotação de auth com *zero-cooldown*, renovação de token estendida silenciosa de 30 dias e supressão de alarmes falsos de inatividade (SessionKeeper). Além disso, corrigiram os nós e botões do login de UI (suporte multilíngue, correções no clique de esqueci a senha, e auto-dismiss de idade).
- **Playwright e Browser**: O upstream agora força **100% das requisições via navegador stealth**, além de tentar curar os erros 401 dinamicamente dentro da página. O arquivo `playwright.ts` teve mais de 760 linhas alteradas.
- **Organização**: Os scripts de inicialização legados (`login.cmd`, `start.cmd`, `sync.cmd`) foram deletados e migrados para a pasta `scripts/` como `.bat` e `.sh`.
- **Performance e Testes**: Adicionados arquivos pesados de stress-test e benchmarks para estressar a máquina (com 100 requisições reais). Extensão de fases de streaming no `streaming.ts`.

## B) Riscos de Colisão no Checklist Dodo (17 Pontos)
Com base na análise de `diff --stat`, os seguintes pilares do **Dodo Shield** correm **alto risco** e terão resolução de conflito manual pesada:

1. **Checklist 6, 7 e 16 (`playwright.ts` & `human-behavior.ts`)**: 
   - **Risco CRÍTICO**: O Upstream reescreveu partes massivas do fluxo do navegador. Há colisão direta com o nosso novíssimo **Soft Recovery (WAF)** (`setWafSoftRecoveryListener`) e a **Curva de Bézier Quadrática** no arraste do mouse.
   - **Risco ALTO**: As janelas invisíveis (Minimizar CDP) e o bloqueio de Viewport rígido (800x800 e Offsets do Launcher Tauri).
2. **Checklist 10 & 8 (`streaming.ts`)**: Risco do upstream sobrescrever a nossa trava de **timeout de inatividade (45_000ms)** e nossa concatenação via Array (Otimização do GC), já que alteraram as fases de streaming.
3. **Checklist 2 (`account.ts`)**: Nosso **Circuit Breaker** (evitar conta com `isAccountRecovering()`) pode colidir com a nova "rotação de auth zero-cooldown" do upstream.
4. **Checklist 4, 9, 16 (`package.json`, `database.ts`, scripts raiz)**:
   - Upstream apagou scripts de arranque nativos. Risco aos nossos untrackeds e scripts nativos.
   - O SQLite `cache_size=-8000` e Playwright Heap (128MB) podem ser engolidos.
   - O comando `start:qwenbridge` no `package.json` precisará de defesa.

## C) Plano de Execução (Passo a Passo)

1. **(Concluído) Pre-Merge Backup**: Já executei com sucesso o script da Seção 4.1 do Guia. O backup seguro com as blindagens encontra-se em `_backup-pre-merge-2026-09-27_22-54`.
2. **Atualização do branch `upstream`**:
   - `git checkout upstream`
   - Rodar o `robocopy` estrito copiando o novo repositório `qwenproxy_john` sobre a pasta, **excluindo expressamente** nossos arquivos confidenciais Dodo (`_contexto-ia`, `docs`, `manager.ps1`, `*.bat`).
   - Fazer o commit de espelho upstream.
3. **Fusão (Merge) em `dodo/main`**:
   - `git checkout dodo/main`
   - `git merge upstream`
4. **Resolução de Conflitos e Injeção de Blindagens (Checklist)**:
   - Tratarei manualmente os blocos em conflito usando a estratégia **Dodo First**.
   - Garantirei que o *Soft Recovery*, as *Curvas de Bézier*, os timeouts curtos e os bounds das janelas voltem exatamente para onde deveriam estar, utilizando a cópia de segurança se necessário.
5. **Auditoria e Validação (Typecheck & Unit Test)**:
   - Rodarei os 17 passos do Checklist de Sobrevivência (grep interno).
   - Executarei `npm run typecheck` e os testes unitários.
6. **Finalização**:
   - Compilarei o resumo das manobras no `resumo-de-trabalho.md` (sob a tag da data de hoje) e o deixarei pronto para envio de commit.

---
Por favor, responda se aprova este plano e eu iniciarei as modificações destrutivas do git (checkout, robocopy, merge).
