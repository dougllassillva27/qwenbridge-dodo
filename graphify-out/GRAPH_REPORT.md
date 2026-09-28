# Graph Report - qwenbridge  (2026-08-16)

## Corpus Check
- 162 files ┬À ~164,985 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1448 nodes ┬À 3537 edges ┬À 90 communities (80 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED ┬À 0% INFERRED ┬À 0% AMBIGUOUS ┬À INFERRED: 15 edges (avg confidence: 0.8)
- Token cost: 0 input ┬À 0 output

## Graph Freshness
- Built from commit: `cddcf526`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]

## God Nodes (most connected - your core abstractions)
1. `StreamingToolParser` - 47 edges
2. `getDatabase()` - 40 edges
3. `qwenUrl()` - 38 edges
4. `tryCreateStreamWithRetry()` - 37 edges
5. `Config` - 36 edges
6. `generateVideo()` - 30 edges
7. `Logger` - 27 edges
8. `generateImage()` - 27 edges
9. `MemoryCache` - 26 edges
10. `initPlaywrightForAccount()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `cleanupServerResources()` --calls--> `closeDatabase()`  [INFERRED]
  src/api/server.ts ÔåÆ src/core/database.ts
- `run()` --calls--> `stopServer()`  [INFERRED]
  src/benchmarks/proxy-baseline.ts ÔåÆ src/api/server.ts
- `run()` --calls--> `startServer()`  [INFERRED]
  src/benchmarks/proxy-baseline.ts ÔåÆ src/api/server.ts
- `run()` --calls--> `loadAccounts()`  [INFERRED]
  src/benchmarks/proxy-baseline.ts ÔåÆ src/core/accounts.ts
- `noteMidStreamNetworkFailure()` --calls--> `markAccountTemporarilyBusy()`  [EXTRACTED]
  src/routes/chat/streaming.ts ÔåÆ src/core/account-concurrency.ts

## Import Cycles
- 2-file cycle: `src/services/auth-playwright.ts -> src/services/qwen.ts -> src/services/auth-playwright.ts`

## Communities (90 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (72): errorForStatus(), isValidStatus(), sendOpenAIError(), estimatePromptTokens(), extractPrompt(), formatGeneratedVideoContent(), handleMediaChatCompletion(), makeCompletionId() (+64 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (65): accountStreamMutexes, acquireAccountStreamLock(), acquireNewQwenChatSession(), activePersonalizationByAccount, asModelRecord(), browserStreamBindingPages, browserStreamError(), BrowserStreamEvent (+57 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (63): accountContexts, AccountHeaderCache, accountMutexes, accountPages, acquireAccountMutex(), alignWindowPosition(), assertAntiBotHeaders(), BrowserEngineConfig (+55 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (53): AccountBenchmarkContext, BENCH_RUN_ID, BenchmarkConfig, benchmarkNonStream(), BenchmarkReport, benchmarkStream(), buildAccountBenchmarkContext(), buildChatBody() (+45 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (21): dashboardApp, faviconPath, formatUptime(), getDashboardData(), serverStartTime, accountsHandler(), LogHub, LogItem (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (32): buildPromptFromMessages(), buildResponseFormatInstruction(), getCurrentPromptStartIndex(), injectToolInstructions(), logIncomingChatRequest(), ParsedRequest, parseRequestBody(), previewText() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (38): author, dependencies, ali-oss, better-sqlite3, dotenv, hono, @hono/node-server, playwright (+30 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (35): EDIT_FILE_TOOLS, fullBody, EDIT_FILE_TOOLS, GREP_TOOLS, WRITE_FILE_TOOLS, ActiveIncrementalToolCall, advanceMarkdownCodeState(), closeTagContentIsParseable() (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (30): gotoBestEffort(), lastFailedRecoveryAt, recoverBaxiaCaptcha(), solveChallengeOnPage(), BAXIA_DOCUMENT_SELECTORS, BAXIA_IFRAME_SELECTOR, BAXIA_IFRAME_SELECTORS, BaxiaCaptchaWatcher (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (29): anthropicError(), app, generateRequestId(), generateMessageId(), mapAnthropicModel(), translateAnthropicToOpenAI(), translateOpenAIToAnthropic(), translateStreamChunk() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (34): Ôÿæ´©Å 10. DELETE de Contas Fantasmas ÔÇö `src/core/accounts.ts`, Ôÿæ´©Å 11. Idle Memory Cleaner ÔÇö `src/services/playwright.ts`, Ôÿæ´©Å 12. Rota Anthropic ÔÇö `src/routes/anthropic/`, Ôÿæ´©Å 13. Alias de Modelos 1M ÔÇö `src/api/models.ts`, Ôÿæ´©Å 14. Cache SQLite Reduzido ÔÇö `src/core/database.ts`, 1. O Problema e a Solu├º├úo, Ôÿæ´©Å 1. Telemetria do Dashboard (Tauri) ÔÇö `src/api/server.ts`, Ôÿæ´©Å 2. Dimensionamento de Janelas ÔÇö `src/services/playwright.ts` (+26 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (21): classifyError(), VALID_STATUSES, AuthError, ClientAbortedError, ContextLengthExceededError, ForbiddenError, InternalError, NotFoundError (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (13): envLevel, isDebugEnabled(), isPassthroughObject(), LEVEL_RANK, LogEntry, Logger, LogLevel, redactLogMessage() (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (19): clearTemporaryBusy(), clearAccountCooldown(), markAccountRateLimited(), invalidatePriorityCache(), invalidateAccountsCache(), updateAccountCooldown(), closeDatabase(), getDatabase() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (22): getCachedAccounts(), loadConfiguredAccounts(), parseEnvAccounts(), syncEnvAccounts(), DATA_DIR, decrypt(), encrypt(), getOrCreateKey() (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (24): createError(), AcquireParams, chatCompletionsStop(), AssistantCompleteEvent, AssistantCompleteHandler, extractChatSessionId(), firstString(), midStreamNetworkFailures (+16 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (27): accountKey(), asRecord(), booleanValue(), cloneCapabilities(), defaultCapabilities, deriveCapabilities(), finitePositiveNumber(), firstPositiveNumber() (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (15): FunctionToolDefinition, JsonSchema, deriveSessionId(), extractTextContent(), buildRepeatedToolCallReminder(), canonicalize(), toolCallKey(), ChatCompletionChunk (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (24): acquirePersonalizationLock(), acquireUpstreamStream(), attemptRelogin(), chatLocks, CreateStreamFailure, hasFreeAlternateAccount(), isAccountUnavailableError(), isAntiBotError() (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (20): app, baseModelId(), expandModelVariants(), getPreferredModelsAccountId(), loadModelsWithVariants(), PublicModel, resolveInitialAccount(), clearAllCooldowns() (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (22): abortLeaseByLabel(), AccountLease, AccountSlot, acquireAccountLease(), AcquireAccountLeaseOptions, ActiveLeaseInfo, cleanupEntry(), createLease() (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (23): classifyQuotaCooldown(), classifyRetryAction(), errCode(), errMessage(), isAccountInitializationError(), isAntiBotError(), isChatInProgressError(), isChatNotExistError() (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (21): closeCurrentFunctionCall(), closeCurrentReasoning(), closeCurrentText(), processChatChunk(), ResponsesStreamState, ResponsesBuiltinTool, ResponsesContentPart, ResponsesFunctionCallInputItem (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (4): findPartialToolOpenIndexOutsideMarkdownCode(), getToolDefinitionName(), normalizeToolNameForMatch(), StreamingToolParser

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (17): BuildContextParams, buildFinalContext(), detectTitleGenerationRequest(), detectTrailingToolResult(), extractMessageText(), FinalContext, getModelContextWindow(), assertPromptWithinLimits() (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (7): Config, env, envSchema, BuildQwenHeadersOptions, QWEN_BASE_URL, CapturedChatRequest, NON_STREAM_CHAT_RESPONSE

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (20): stripFastSuffix(), buildInProgressResponse(), ChatChoice, chatCompletionsToResponses(), ChatHistoryMessage, ChatMessage, ChatRequest, ChatResponse (+12 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (14): buildStartedServerInfo(), extractProvidedApiKeys(), formatAccountId(), getErrorMessage(), handleSignal(), installSignalHandlers(), LEGACY_REDIRECTS, prepareAccountRuntime() (+6 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (20): ­ƒôî 1. Por que rodar no Docker em vez de uma VM tradicional?, ­ƒôï 2. Pr├®-requisitos (O que voc├¬ precisa ter instalado), ÔÜÖ´©Å 3. Configura├º├úo dos Arquivos, ­ƒÜÇ 4. Passo a Passo de Execu├º├úo (Como Usar), ­ƒÄø´©Å 5. Tr├¬s Formas F├íceis de Controlar o Proxy, ­ƒøæ 6. Comandos ├Üteis do Dia a Dia, ­ƒöî 7. Como Conectar suas Ferramentas (Cline, Roo Code, Cursor, LibreChat), ­ƒøí´©Å 8. O que acontece com os meus Logins e Contas? (+12 more)

### Community 30 - "Community 30"
Cohesion: 0.23
Nodes (21): getBasicHeaders(), getQwenHeaders(), isAuthMockEnabled(), isTokenExpiringSoon(), buildCapturedQwenHeaders(), buildQwenSettingsUpdatePayload(), createQwenChatSession(), deleteAllQwenChats() (+13 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (8): getToolDefinitionProperties(), isJsonPayloadTruncated(), parseJsonishString(), scanJsonStructureIncomplete(), closeBraces(), fixMissingOpeningQuotes(), robustParseJSON(), sanitizeAndBalance()

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (14): hasActiveAccountLease(), subtlePageActivity(), closeIdlePlaywrightAccounts(), evictIdlePlaywrightContextsToLimit(), getActivePlaywrightAccountIds(), getIdlePlaywrightAccountIds(), isAccountServingStream(), keepAlivePlaywrightAccount() (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.21
Nodes (15): finalizeResponse(), responsesOutputToChatMessages(), app, start(), cache, deleteStoredResponse(), ensureTable(), getResponseHistory() (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.21
Nodes (14): cleanupServerResources(), getAccountCredentials(), ensurePlaywrightInitialized(), HeaderResult, isRunningUnderNodeTest(), deleteChatsForAccount(), deleteChatsForConfiguredAccounts(), DeleteChatsResult (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (15): clearFingerprintCache(), DEVICE_MEMORIES, FingerprintProfile, getFingerprintProfile(), HARDWARE_CONCURRENCIES, LANGUAGE_PROFILES, mulberry32(), NOT_A_BRAND_VARIANTS (+7 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (14): applyUpstreamUsage(), asFiniteNumber(), buildDeltaResult(), buildUsage(), createUsageAccumulator(), DeltaResult, formatThinkingSummaryContent(), getIncrementalDelta() (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.23
Nodes (5): isToolcallDebugEnabled(), ParserResult, parseToolArgumentsStrict(), repairCommonMalformedToolJson(), ParsedToolCall

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (15): ResponsesRequest, BuiltInToolSchema, ContentPartSchema, FunctionCallInputSchema, FunctionCallOutputInputSchema, FunctionToolSchema, InputMessageSchema, MessageInputSchema (+7 more)

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (10): getModelCapabilities(), getModelContextWindowSource(), BuildContextMeterInput, buildContextMeterSnapshot(), ContextMeterOptions, enrichUsageWithContextMeter(), getReservedOutputTokens(), roundPercent() (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.14
Nodes (13): Anti-bot, Compatibilidade real das rotas, Deploy com Docker, Disclaimer, Estrutura do projeto, Principais funcionalidades, Pr├®-requisitos, QwenBridge (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (11): acquireChatLock(), chatCompletions(), formatTimingHeader(), shouldRetryChatInProgressOnSameAccount(), shouldRetryInvalidInputOnSameAccount(), handleChatCompletionsError(), processStreamingResponse(), abortLeaseBySessionLabel() (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.39
Nodes (11): prepareRemainingAccountsInBackground(), addAccount(), listAccounts(), removeAccount(), maskEmail(), addAccountFlow(), askQuestion(), clear() (+3 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (4): app, getFreePort(), isPortAvailable(), modelsPayload

### Community 46 - "Community 46"
Cohesion: 0.40
Nodes (9): DATA_DIR, ensureAccountInPriority(), isPersistableAccount(), loadPriority(), markAccountFailed(), markAccountSuccessful(), PRIORITY_FILE, PriorityData (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.20
Nodes (10): Cache e contexto, CAPTCHA autom├ítico, Contas e sess├úo, Delays e retry, Headers anti-bot, Observabilidade, Playwright / processos, Rede e seguran├ºa (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.36
Nodes (7): CreateStreamSuccess, StreamCreationResult, ContextMeterSnapshot, isEnabled(), logTokenEstimationSample(), ratio(), TokenEstimationContext

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (3): CacheEntry, CacheKey, decompressAsync

### Community 51 - "Community 51"
Cohesion: 0.52
Nodes (6): coerceParameterValue(), decodeXmlEntities(), extractToolName(), inferToolNameFromParameters(), parseRecoverableXmlToolCall(), parseXmlParameterToolCall()

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): Ô£à Frase de Aprova├º├úo do Relat├│rio, ÔÜá´©Å Frase de Emerg├¬ncia (Algo Quebrou P├│s-Merge), ­ƒöÄ Guia de Preenchimento, ­ƒôï Mensagem Padr├úo (copiar daqui), ­ƒô¿ Template de Mensagem ÔÇö Merge de Atualiza├º├úo Upstream

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (6): Anthropic SDK, cURL, Exemplos de uso, Grok CLI (config), OpenAI Responses API (Codex / Grok CLI), OpenAI SDK (Node.js)

### Community 54 - "Community 54"
Cohesion: 0.47
Nodes (5): app, CompletionsBody, completionsError(), completionsLegacy(), makeCompletionId()

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (4): getFreePort(), isPortAvailable(), localTools, toolDefinitions

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (3): declaredTools, multiCallTools, truncatedWrite

### Community 58 - "Community 58"
Cohesion: 0.50
Nodes (3): docker-entrypoint.sh script, DISPLAY, ensure_writable_dir()

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (5): Exemplo: effort com Codex/Grok, Exemplo: Responses API com mem├│ria, Features, Reasoning effort mapping, Responses API (`/v1/responses`)

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (3): isWafChallenge(), ParsedQwenErrorPayload, parseQwenErrorPayload()

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (4): Anthropic Compatible, Endpoints, OpenAI Compatible, Utilidades

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (4): Exemplo m├¡nimo, Iniciar, In├¡cio r├ípido, Startup multi-conta

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (3): EDIT_FILE_TOOLS, FLAT_TOOLS, TOOLS

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (3): Anthropic (Claude ÔåÆ Qwen), Model mapping, Responses API (GPT ÔåÆ Qwen)

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (3): Arquitetura, Autentica├º├úo, Transporte upstream e streaming

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (3): Capabilities, Modelos e contexto, Variantes sint├®ticas

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (3): Instala├º├úo, Via Docker, Via npm

## Knowledge Gaps
- **392 isolated node(s):** `DISPLAY`, `name`, `version`, `description`, `main` (+387 more)
  These have Ôëñ1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** ÔÇö run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `Community 3` to `Community 19`, `Community 27`, `Community 14`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `Config` connect `Community 25` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 8`, `Community 9`, `Community 13`, `Community 15`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 24`, `Community 27`, `Community 32`, `Community 33`, `Community 34`, `Community 40`, `Community 42`, `Community 49`, `Community 54`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `StreamingToolParser` connect `Community 23` to `Community 38`, `Community 7`, `Community 71`, `Community 15`, `Community 51`, `Community 56`, `Community 31`, `Community 63`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getDatabase()` (e.g. with `countRows()` and `getRow()`) actually correct?**
  _`getDatabase()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DISPLAY`, `name`, `version` to the rest of the system?**
  _392 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06134371957156767 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04560954816709292 - nodes in this community are weakly interconnected._
