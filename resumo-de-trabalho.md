# Resumo de Trabalho - Manutenção e Fixes (QwenBridge)

## Problemas Resolvidos
1. **Erro de Sessão `is not exist`**: O Qwen deixou de aceitar IDs de sessão criados no cliente (via UUID), resultando no erro constante de "não existe".
2. **Perda de Timestamps**: Após atualizações e tentativas de merge, os logs globais da aplicação estavam saindo sem formatação de data/hora, prejudicando o monitoramento.
3. **Travamentos e Timeout no Playwright**: A automação tentava buscar a caixa de texto para bypass de anti-bot usando seletor antigo/lento, travando as execuções por 30s.
4. **Alibaba Anti-bot Bypass (`FAIL_SYS_USER_VALIDATE`)**: A proteção "RGV587_ERROR" estava sendo ativada consistentemente por dois motivos:
   - A aba estava oculta (minimizada via CDP) de forma permanente, falhando checagens de visibilidade do Alibaba.
   - Após 15 minutos de inatividade, o navegador da conta era morto (destruído) para poupar memória, mas o bypass do antibot não o reabria, apenas jogava a conta em cooldown perpétuo.

## Soluções Aplicadas Cirurgicamente (Mantendo as blindagens e otimizações de memória do "Dodo Shield"):
1. **Chat Session Endpoint API (`src/services/qwen.ts`):** Identificada a ausência do UUID no `chatSessionId` e redirecionada a lógica para acionar a rota `/api/v2/chats/new` (por meio de `acquireNewQwenChatSession`), garantindo um ID real aprovado pelo backend antes de invocar a stream.
2. **Timestamps Globais (`src/index.ts`):** Injetado um wrapper nativo no `console.log`, `console.warn`, etc. Utilizando `Intl.DateTimeFormat` no fuso horário `America/Sao_Paulo` para carimbar qualquer saída no terminal, resolvendo o problema definitivamente.
3. **Timeouts Resilientes (`src/services/playwright.ts`):** Envolvemos os eventos de `page.focus()` no textarea em `try-catch` com um limite super reduzido de 5 segundos. Dessa forma, caso o DOM do Qwen não tenha a caixa presente, a pipeline continua sem matar o node.
4. **Anti-bot Bypass - Foco Visual e Ressurreição (`src/routes/chat/account.ts` & `src/services/playwright.ts`):**
   - No `account.ts`, atualizada a intercepção da flag `isAntiBot` para testar se o navegador do Playwright da conta específica está inativo. Caso esteja, chama proativamente o método `initPlaywrightForAccount` injetando uma nova vida no contexto (ressurreição).
   - No `playwright.ts` (na rotina interna de `refreshHeaders`), adicionadas chamadas via Chrome DevTools Protocol (`setWindowBounds`) para alternar do estado `minimized` para `normal` + `bringToFront()`. O Playwright ganha a tela, resolve o Anti-Bot provando visibilidade pro Alibaba e logo em seguida volta ao estado `minimized`.

## Status
Tudo verificado e passando livremente no Typecheck, pronto para deploy em produção!

## Atualização de Upstream (v1.12.9) - Merge Cirúrgico Estrito
1. **Integração de Código Base**: Integradas as atualizações do upstream v1.12.9 aos arquivos de Produção.
2. **Preservação do Manifesto (alterações-dodo.md)**: As seguintes customizações foram rigorosamente blindadas e mantidas:
   - **account.ts**: Mantido o cooldown estratégico de 30s para erros de Anti-bot e adaptado o mutex de acesso (`isIdle()`).
   - **playwright.ts**: Preservada a lógica do `solveBaxiaCaptcha`, ciclo de vida das instâncias persistentes `globalBrowser`, stealth plugins, e automação nativa da janela (minimize/maximize).
   - **server.ts**: Conservado o middleware DodoRateLimitModule (`/metrics/accounts`), configurações customizadas de timeouts HTTP longos (`30 * 60 * 1000`), adicionadas novas rotas do Upstream (`responsesApp`) e injetados hooks globais de gerenciamento (`session-keeper.ts`).
   - **config.ts**: Mantidos esquemas nativos com adição cirúrgica dos novos timeouts de navegação requeridos pelo Playwright (`navigation`, `page`, `headers`).
3. **Resolução de Conflitos e Tipagem**: Todos os contratos de interfaces TypeScript divergentes (`StreamCreationResult`, `CreateStreamSuccess`) foram unificados perfeitamente.
4. **Clean Build**: Validação rigorosa garantindo 100% de sucesso sem erros de sintaxe ou checagem via `npm run typecheck`.

## Hotfix (03/07/2026) - Loop Infinito de Inicialização
- **playwright.ts**: Corrigida a função `captureHeaders`. Antes, quando o tempo limite de `page.goto` era excedido devido a alta carga de processos Chromium, a função resolvia silenciosamente a promise sem rejeitar o erro. Isso causava um loop infinito de inicialização no Qwen porque o servidor ficava aguardando eternamente pelos cabeçalhos que nunca chegaram. A promise agora rejeita apropriadamente com um timeout dedicado de 60s, permitindo que a conta falha seja ignorada e a inicialização geral da API continue estável.

## Hotfix (03/07/2026) - Bypass do Novo Aliyun Puzzle Captcha
- **playwright.ts & captcha-solver.ts**: O Alibaba atualizou sua segurança, introduzindo um novo "Puzzle Captcha" (Quebra-cabeça). As classes antigas (`#nc_1_n1z`, etc) não o detectavam. Injetamos os novos seletores cirurgicamente (`#WAF_NC_WRAPPER`, `#aliyunCaptcha-window-embed`, `#aliyunCaptcha-sliding-slider`, `#aliyunCaptcha-sliding-body`) para que o proxy o detecte corretamente.
- **Integração com ChatGPT Vision**: Como o novo captcha é de imagem (puzzle), o `captcha-solver` foi aprimorado para pular a tentativa matemática genérica (que arrastaria até o final, falhando o teste) caso a classe `.puzzle` seja detectada. Agora, ao detectar o puzzle, ele delega instantaneamente para o microserviço de Visão Computacional na 3ª tentativa, garantindo que o slider pare no eixo X exato, sem bloquear a conta por falhas consecutivas.

## Hotfix (03/07/2026) - Ajuste Visual das Janelas (UI)
- **playwright.ts**: Quando rodando no modo visível (`HEADLESS=false`), o Playwright estava forçando fisicamente as janelas do Chromium a redimensionarem para bater com a resolução de impressão digital do usuário (geralmente 1920x1080), o que fazia as janelas estourarem para fora da tela. Ajustamos o parâmetro de launch `--window-size=800,600` e sobrescrevemos dinamicamente o `viewport` e `screen` para 800x600 *exclusivamente* quando o headless está desativado. Isso mantém a camuflagem anti-bot intacta em produção, mas permite que as janelas fiquem amigáveis, menores e centralizadas no monitor do launcher quando visualizadas.

## Hotfix (03/07/2026) - Interceptação de Captcha no fluxo de Login UI
- **playwright.ts**: O firewall do Alibaba passou a forçar os Puzzle Captchas diretamente na etapa de *login* (`/auth`), antes ou durante a digitação de email/senha. Antes, a detecção de captcha só ocorria na obtenção dos cabeçalhos, logo, quando ele batia de frente com um captcha no login, ele congelava na tela esperando um campo (email/senha) que estava escondido atrás do modal do captcha, resultando num falso-positivo de timeout. Inserimos uma verificação ativa de Captcha (invocando o solver + ChatGPT Vision) dentro da função `loginViaUi`, executando após a abertura da página e a cada caractere preenchido (email e senha), garantindo um fluxo inquebrável.

## Feature (03/07/2026) - Sistema de Logs Estruturados
- **logger.ts**: Criado um sistema de logs centralizado (`src/utils/logger.ts`) focado em rastrear o ciclo de vida do proxy com categorias precisas e coloridas no console, além de datas e horas exatas.
- **Integração Global**: Substituídas dezenas de instâncias de `console.log` por todo o sistema (`playwright.ts`, `captcha-solver.ts`, `index.ts`) por `Logger.info`, `Logger.captcha`, `Logger.auth`, `Logger.error`, etc. Agora o output em `Logs_QwenBridge.txt` está profissional, timbrado cronologicamente e categorizado (facilitando muito a auditoria de problemas com contas ou banimentos pelo WAF).

## Hotfix (12/07/2026) - Correção de Rotas do Dashboard, Sincronização do SQLite e Ajuste do Chromium
- **Dashboard:** Recriada a rota `/metrics/accounts` no servidor `src/api/server.ts` com estrutura JSON validada e injeção de CORS (`Access-Control-Allow-Origin: *`), resolvendo o bug de 'Bridge Offline' enfrentado pelo Proxy Launcher.
- **Janelas do Playwright:** Refatoração nos parâmetros de inicialização do Chromium (`src/services/playwright.ts`). As janelas agora leem as variáveis `LAUNCHER_WINDOW_X/Y` do Rust, aplicam offsets (`-400` e `-550`) e abrem perfeitamente centralizadas sobre o Monitor 1 do launcher, com tamanho estrito de 800x800 pixels e flag nativa `--start-minimized`.
- **Sincronização SQLite:** Injetada rotina de expurgo de contas em `src/core/accounts.ts`. Adicionado `DELETE FROM accounts WHERE email NOT IN (...)` na transação de sync do `.env`, prevenindo e apagando as contas fantasmas remanescentes no banco de dados.

## Atualização de Upstream e Merge Cirúrgico (15/07/2026)
1. **Integração Upstream**: Incorporação dos novos recursos do Upstream (nova autenticação `x-api-key`, melhorias no `/health` monitorando RAM/Heap, novo `memory-usage.ts`, novos `captcha-solver`) na produção.
2. **Preservação de Manifesto Dodo**: 
   - `playwright.ts`: Mantidas a injeção estrita de parâmetros (`--window-position`, `--start-minimized`), viewport fixo em 800x800 e o *Idle Memory Cleaner* rodando de hora em hora.
   - `server.ts`: Reinjeção total do nosso bloco `accountsHandler` com rotas do painel e suporte `CORS` em `/metrics/accounts`.
   - `accounts.ts`: Preservada a exclusão de contas orfãs (`DELETE FROM accounts`) na transação.
   - `config.ts`, `.env` e `package.json`: Reposta a script `start:qwenbridge` e reforçado limite severo de RAM (`PLAYWRIGHT_JS_HEAP_MB=128`).
3. **Saneamento Total**: Excluídos arquivos largados pelo upstream (`schema.ts`, `topic-detector.ts`, testes obsoletos) e corrigidas referências antigas em `auth-http.ts`. Repositório 100% validado no TypeScript.

## Atualização de Upstream e Merge Cirúrgico (16/07/2026)
1. **Integração Upstream (Resiliência de Streams)**: Sincronizados novos recursos do upstream focados no tratamento resiliente de erros mid-stream (erros de cota, erros de rede e quedas na geração são tratados como `RetryableQwenStreamError` disparando troca de conta automática no loop de retry).
2. **Preservação de Manifesto Dodo**:
   - `streaming.ts`: Mantidos os hooks do dashboard (`recordAccountTokens`) e a substituição da concatenação recursiva de strings por arrays para otimização do Garbage Collector nas variáveis `finalContent` e `reasoningBuffer` em ambas as respostas (stream e non-stream).
   - `package.json`: Preservado o script de inicialização do launcher `"start:qwenbridge"` e adicionado o novo arquivo de testes `stream-retry.test.ts` à suite de testes mock.
   - **Minimização do Chromium (playwright.ts & captcha-solver.ts):** Implementadas rotinas via Chrome DevTools Protocol (`Browser.getWindowForTarget` e `Browser.setWindowBounds`) para minimizar automaticamente os navegadores ao iniciar, atualizar cabeçalhos ou executar keepalive. Caso um captcha seja detectado, a janela correspondente é restaurada para a tela (estado `normal`) para garantir a precisão dos cliques do solver (ou resolução manual) e minimizada de volta imediatamente após a conclusão.
3. **Validação**: TypeScript compilando limpo (`npx tsc --noEmit`) e nova cobertura de testes para retentativas de stream acoplada com sucesso.
4. **Hotfix de Contexto (streaming.ts)**: Corrigida a omissão da chamada do helper `rememberParent` dentro do parser SSE de `processStreamingResponse`. Sem este registro, a árvore de mensagens do Qwen não atualizava o ponteiro da última mensagem (`parent_id`) para requisições de stream (usadas nativamente por ferramentas do Cursor/Cline), resultando na perda total de histórico nos turnos subsequentes ( fazendo o Qwen esquecer as instruções do usuário e responder como se fosse um chat zerado).

## Atualização de Upstream e Merge Cirúrgico Estrito (22/07/2026)
1. **Integração de Recursos do Upstream**:
   - Sincronizado suporte nativo ao modelo `qwen3.8-max-preview` (1M contexto) e registro de capacidades `ModelCapabilities`.
   - Stack atualizado para **TypeScript 7.0.2**, **Playwright v1.61.1**, **Hono 4.12.31** e **better-sqlite3 12.11.1**.
   - Incorporadas otimizações de streaming: micro-buffer SSE (8KB/3ms thresholds), delta O(1) de 32 bytes e saída imediata no `[DONE]`.
   - Limpeza de serviços e testes obsoletos apagados no upstream (`payload-summarizer`, `thread-context-*`, etc).
   - Injeção de feedback de erro para chamadas de ferramentas malformatadas ou não declaradas.
   - Novo visual de startup com banner ASCII e exibição do endpoint `/v1`.
2. **Preservação Integral do Manifesto Dodo (`alterações-dodo.md`)**:
   - **`database.ts`**: Mantida a trava de cache SQLite em 8MB (`cache_size = -8000`).
   - **`config.ts`**: Mantido o limite default de heap Playwright em 128MB (`PLAYWRIGHT_JS_HEAP_MB = 128`).
   - **`accounts.ts`**: Preservada a exclusão de contas órfãs SQLite (`DELETE FROM accounts WHERE email NOT IN (...)`).
   - **`metrics.ts`**: Mantida a exportação e contabilização de tokens por conta (`accountTokenUsage` e `recordAccountTokens`).
   - **`server.ts`**: Re-injetados os handlers `/accounts` e `/metrics/accounts` + cabeçalhos CORS (`Access-Control-Allow-Origin: *`, `OPTIONS 204`) para a UI Tauri do Proxy Launcher.
   - **`playwright.ts`**: Mantidos parâmetros `--js-flags=--max-old-space-size=128`, posicionamento em multi-telas via `LAUNCHER_WINDOW_X/Y` (offsets `-400`/`-550`), viewport fixo em `800x800` e minimização de janelas.
   - **`upload.ts`**: Fusão do import `getOSSModule()` singleton do Upstream com o upload streaming por `putStream` do Dodo (<10MB RAM).
   - **`streaming.ts`**: Mantida a acúmulo de buffers via Arrays (`.push()` / `.join("")`) para otimização de GC + chamada do `recordAccountTokens()`.
3. **Correção em Testes (`server-lifecycle.test.ts`)**:
   - Ajustada validação da porta no teste de ciclo de vida para respeitar `process.env.PORT` dinamicamente.
4. **Validação Completa**:
   - Checagem de tipos TypeScript (`npx tsc --noEmit`) concluída com 0 erros.
   - Suíte de testes simulados (`npm run test:mock:fast`) concluída com 100% de sucesso em todas as 292 asserções.

## Hotfix (22/07/2026) - Métricas e Dashboard da Home do Proxy Launcher
- **`server.ts`**: Corrigida a carga do JSON em `/metrics/accounts` e `/accounts`. Adicionadas as chaves esperadas pelo `dashboard.js` do Proxy Launcher: `total`, `active`, `cooldown`, `requests`, `ram_mb`, `stream_errors`, `cooldown_until` e `cooldown_reason`.
- **`helpers.ts`**: Atualizado o parser `applyUpstreamUsage` para aceitar dinamicamente `input_tokens`/`prompt_tokens` e `output_tokens`/`completion_tokens`.
- **`streaming.ts`**: Adicionada estimativa de fallback para tokens (`Math.ceil(prompt.length / 4)` e `Math.ceil(completion.length / 4)`) quando a API do Qwen Web omitir a estatística nos dados brutos do SSE, garantindo atualização e persistência contínua da contabilização por conta (`recordAccountTokens()`).

## Hotfix (22/07/2026) - Restauração da Minimização CDP das Janelas Chromium
- **`playwright.ts` & `captcha-solver.ts`**: Restauradas as funções `minimizeWindow(page)` e `restoreWindow(page)` via Chrome DevTools Protocol (`Browser.getWindowForTarget` e `Browser.setWindowBounds` com `windowState: "minimized"` / `"normal"`). As janelas do Chromium voltam a ser minimizadas automaticamente no boot do Playwright, na atualização de headers e no keepalive, sendo exibidas na tela exclusivamente durante a resolução de captchas do Alibaba.

## Hotfix (22/07/2026) - Trava de Inatividade SSE (Idle Stream Timeout - 120s)
- **`streaming.ts`**: Adicionado wrapper `readWithTimeout` (120 segundos) em todas as leituras de stream (`reader.read()`). Se o backend do Qwen Web travar ou demorar excessivamente no processamento de históricos gigantescos (ex: chats com 235+ mensagens), a leitura dispara o erro `RetryableQwenStreamError("upstream_idle_timeout")` após 2 minutos em vez de congelar por mais de 8 minutos até o Claude estourar seu timeout do cliente. O proxy rotaciona a conta e re-envia a requisição de forma transparente.

## Hotfix (03/08/2026) - Correção de Alucinação Plural em Tool Calls (<tool_calls>)
- **src/tools/parser.ts**: Adicionada uma blindagem (auto-fix regex) que intercepta os chunks em tempo real na função feed() e substitui marcações erráticas de <tool_calls> pelo padrão singular esperado (<tool_call>). Isso resolve um bug clássico onde modelos da família Qwen usam a nomenclatura plural na tag (herdada do formato JSON da API OpenAI), causando travamento no fluxo de extração da ferramenta do streaming (gerando apenas saída de texto puro em vez de JSON interpretável).

## Atualização de Upstream e Pente Fino (03/08/2026)
1. **Integração Completa (Upstream -> Dodo Prod)**:
   - Sincronizado o QwenBridge de produção com as novidades de fluxo contínuo do repositório oficial (Upstream), absorvendo estabilizações de runtime.
   - Foram restaurados os scripts nativos de execução (`start:qwenbridge`) no `package.json` que a equipe original havia removido.
2. **Re-Auditoria do Manifesto Dodo (`alterações-dodo.md`)**:
   - Foram consolidadas e reativadas integralmente **todas** as customizações vitais (GC-friendly buffers no streaming, cache 8MB do SQLite, cleanup ocioso de instâncias Chrome, exclusões SQLite, CORS fixo na API, e integração OSS direta via `putStream`).
   - A configuração de janelas (Minimização via CDP, Window Size forçado em 800x800 e cálculo do offset LAUNCHER_WINDOW_X/Y) foi reaplicada à força após um teste de estresse indicar o abandono dessas flags pelo Chromium Builder base.
3. **Estabilidade Comprovada**:
   - Typecheck (tsc --noEmit) de TypeScript passou liso (corrigindo pequenos abandonos como o `getAccounts` pelo novo `listAccounts`).

## Hotfix (03/08/2026) - Recuperação de Telemetria do Dashboard Tauri e Playwright Viewport
- **`server.ts`**: Reintegrado o handler robusto legado `accountsHandler` (perdido no merge do Upstream), encarregado de injetar os metadados ricos em `/accounts` e `/metrics/accounts` (`ram_mb`, `stream_errors`, `cooldown_until`, `cooldown_reason`, `requests`, `active`, `total`). O painel principal do Proxy Launcher voltou a espelhar a saúde exata da pool.
- **`playwright.ts`**: Imobilizada a resolução interna do contexto do Playwright com `viewport: { width: 800, height: 800 }` e `screen`. Isso anulou a teimosia do Playwright em restaurar a janela para `1920x1080` herdada dos pacotes de `fingerprint` inseridos na injeção anti-bot.
- **`playwright.ts`**: Adicionado tratamento preventivo contra env vars nulas (`!isNaN()`) no parseamento de `LAUNCHER_WINDOW_X` e `Y` que poderia causar travamento na spawn das janelas fora de visão.

## Atualização de Upstream e Sincronização Final (06/08/2026)
1. **Merge Cirúrgico Dodo Shield**:
   - Integração da nova build oficial com robocopy.
   - **`server.ts`**: Reinjeção imediata do dashboard handler para não matar as métricas do launcher.
   - **`playwright.ts`**: Reinjeção do dimensionamento rígido (800x800) e script CDP para minimização em tempo de boot (fuga de flashes na tela e estresse da placa de vídeo).
   - **`accounts.ts` & `metrics.ts`**: Mantidas a purga no SQLite (via sync `.env`) e a exportação do cache de tokens consumidos pelas sessões.
   - **`server-lifecycle.test.ts`**: Substituída a porta hardcoded `3000` por porta randômica dinâmica `0` para que a rotina de testes (se ativada em background) não derrube o processo de produção na porta nativa.
2. **Correção do Bug de Timeout Reverso do Claude (Hotfix Crítico)**:
   - **Problema**: O Upstream substituiu o gerenciamento de eventos do Playwright com um `STREAM_READ_TIMEOUT_MS` de altíssima latência (120 segundos). Como clientes nativos como o Claude Desktop e webUI dão timeout de conexão entre 100~105 segundos, o proxy falhava em entregar os chunks e nunca gerava os fallbacks internos, deixando logs completamente em branco.
   - **Solução**: O timeout de inatividade SSE do proxy em `src/routes/chat/streaming.ts` foi estrangulado de **120_000ms para 45_000ms**. Dessa forma, se o LLM do backend (Alibaba Qwen) congelar na geração de chunks pesados, o Proxy toma a atitude primeiro, atira um `RetryableQwenStreamError`, gira a instância transparente em um novo worker Playwright e resume a string antes da barra de 100 segundos do Claude ser engatilhada.

## Atualização de Upstream e Merge Cirúrgico Estrito (06/08/2026)
1. **Integração de Código Base**: Integrado o novo código do Upstream que mudou radicalmente a lógica de captura de Headers (agora usa async Promise-based com micro-filas) para o arquivo `src/services/playwright.ts`.
2. **Preservação do Manifesto (alterações-dodo.md)**: 
   - **Minimização (CDP)**: Como a nova flag `--start-minimized` do Chrome parou de renderizar o DOM em background e passou a engolir as requisições gerando Timeout (60000ms) no `page.goto`, as janelas agora abrem normalmente (tamanho 800x800 e invisíveis para detecção bot) e em seguida a função Dodo `await minimizeWindow(acctPage);` as joga para a bandeja imediatamente após a captura dos headers.
   - **Debug HTML Dump Async**: Reescrita do despejo de depuração (`qwen_debug_dump.html`) para garantir persistência nativa de captchas do Alibaba via `await import('fs')`, garantindo a visibilidade da tela caso o fluxo gere a exceção "No completion request" por causa do WAF.
   - **Métricas do Tauri**: Mantida 100% da estrutura da rota de `/accounts` e `/metrics/accounts` no `server.ts` (RAM, streams, tempo de cooldown) para garantir a saúde das informações exibidas no Proxy Launcher Tauri.
3. **Correção de Comunicação com Proxy Launcher**: Foi preciso retornar estritamente a variável de porta `PORT=50002` no arquivo `.env` e ativá-la, já que o Launcher Tauri usa ela fixada no Rust (`check_proxy_status`) via socket ping. Quando ausente, o Proxy Launcher ficava girando no estado "Iniciando..." infinitamente pois batia de frente com uma porta TCP não respondendo.

## Atualização de Upstream e Merge Cirúrgico Estrito (20/08/2026) — Commit 96c3832
1. **Integração de Upstream (johngbl/QwenBridge 9b61572..96c3832)**:
   - **Parallel Escape**: Implementada rotação e escape para turnos e chats auxiliares/paralelos (`getNextFreeAccountForParallel`, `effectivePreferred = params.parallelEscape ? null : preferredAccountId`), impedindo que gerações secundárias travem por 18s aguardando a liberação de slots busy.
   - **Remoção do Direct Completions Fetch**: O WAF Baxia do Alibaba barra requisições POST de completions feitas diretamente de Node (TLS/HTTP stack fingerprinting). Completions agora passam 100% pelo browser relay com `buildCompletionHeaders` (incluindo `bx-ua`/`bx-umidtoken`), enquanto o endpoint de `settings/update` (personalization) permanece em Node fetch rápido sem WAF.
   - **Refactor de Branding e Limpeza**: Suporte ao branding `QwenProxy` e limpeza de arquivos obsoletos (`live-direct-probe-*`, `live-tls-fingerprint-test.ts`, `completions-direct-fetch.test.ts`).
2. **Preservação Integral de 100% das Blindagens Dodo (`alterações-dodo.md`)**:
   - **Checklist #1 (Telemetria Dashboard)**: Endpoints `/metrics/accounts`, `/accounts` e `/api/dashboard/*` preservados e acoplados com `recordAccountTokens`.
   - **Checklist #2 e #3 (Janelas e Minimização CDP)**: Offsets do launcher (`cx - 400`, `cy - 550`), guard `!isNaN()`, limpeza de `window_placement` em `Preferences`, e minimização automática via CDP (`minimizeWindow`).
   - **Checklist #4 (Headless)**: Padrão `PLAYWRIGHT_HEADLESS=false` mantido no `src/core/config.ts`.
   - **Checklist #5 (Micro-buffering SSE)**: `BROWSER_STREAM_FLUSH_BYTES = 128` e `BROWSER_STREAM_FLUSH_MS = 10` para entregas de chunks em tempo real.
   - **Checklist #6 (Scripts Package.json)**: Script `"start:qwenbridge": "npx tsx src/index.ts"` preservado.
   - **Checklist #7 (Resiliência de Foco)**: `try { await page.focus(..., { timeout: 5000 }); } catch { ... }` intacto.
   - **Checklist #8 e #9 (Porta e Inicialização)**: Porta `50002` e inicialização sequencial `PLAYWRIGHT_INIT_BATCH_SIZE=1` preservadas.
   - **Checklist #10 (Contas Fantasma)**: `DELETE FROM accounts WHERE email NOT IN (...)` mantido no sync do SQLite.
   - **Checklist #12 (Rota Anthropic)**: Sub-aplicação `src/routes/anthropic/` montada e mantida no `server.ts`.
   - **Checklist #13 (Aliases 1M)**: Aliases de contexto estendido `[1M]`, `-fast[1M]` e `-thinking[1M]` mantidos no `src/api/models.ts`.
   - **Checklist #14 (SQLite Cache & Migração)**: `cache_size = -8000` (8MB) e migração de `qwenbridge.db` legado para `qwenproxy.db` garantidas no `src/core/database.ts`.
3. **Validação Completa**:
   - `npm run typecheck`: **0 erros de tipagem**.
   - `npm run test:mock`: **540/540 testes passando (100% verde)**.
