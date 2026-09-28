# Manual de Merge Dodo -- QwenBridge

> **Versao:** 2.0 - **Atualizado em:** 25/09/2026
> **Objetivo:** Garantir que nenhuma blindagem Dodo seja perdida ao integrar atualizacoes do upstream.

---

## Indice

1. [O Problema e a Solucao](#1-o-problema-e-a-solucao)
2. [Visao Geral da Estrategia](#2-visao-geral-da-estrategia)
3. [Setup Inicial -- Fazer Uma Unica Vez](#3-setup-inicial)
4. [PRE-MERGE OBRIGATORIO -- Backup de Arquivos Locais](#4-pre-merge-obrigatorio)
5. [Fluxo de Atualizacao -- Passo a Passo](#5-fluxo-de-atualizacao)
6. [Resolvendo Conflitos Git](#6-resolvendo-conflitos-git)
7. [Checklist de Sobrevivencia Pos-Merge](#7-checklist-de-sobrevivencia-pos-merge)
8. [Rollback de Emergencia](#8-rollback-de-emergencia)
9. [Recuperacao de Arquivos Untracked Perdidos](#9-recuperacao-de-arquivos-untracked-perdidos)
10. [Referencia Rapida de Comandos](#10-referencia-rapida-de-comandos)

---

## 1. O Problema e a Solucao

### Como era antes

Cada atualizacao do upstream era um processo manual:
- Baixar os arquivos novos
- Comparar visualmente arquivo por arquivo
- Tentar lembrar/reler o `alteracoes-dodo.md` e reinjetar tudo na mao
- Alta chance de esquecer algo -> funcionalidade perdida -> remendo pos-update

### Como e agora

Utilizamos uma **estrategia de dois branches Git**:

| Branch | Dono | Descricao |
|--------|------|-----------|
| `upstream` | Codigo do dono do projeto | Recebe o upstream puro, **nunca editamos aqui** |
| `dodo/main` | Nosso codigo de producao | Tem TODAS as blindagens Dodo, e o branch que roda |

Quando chega um update: fazemos `git merge upstream` no `dodo/main`.
O Git mostra **somente os conflitos reais** -- os pontos onde o upstream tocou em algo que tambem customizamos.
Isso transforma horas de comparacao manual em minutos de revisao focada.

---

## 2. Visao Geral da Estrategia

```
[Upstream Original]
       |
       | (novo release)
       v
[branch: upstream] -- espelho limpo, sem toques Dodo
       |
       | git merge upstream
       v
[branch: dodo/main] -- producao com TODAS as blindagens
       |
       | (e daqui que o Proxy Launcher roda)
       v
[Servidor em Producao]
```

**Regra de ouro:** Nunca edite codigo no branch `upstream`. Ele deve sempre ser identico ao codigo que o dono do projeto entregou.

---

## 3. Setup Inicial

> Este setup ja foi executado. Esta secao existe apenas para referencia historica.

A estrutura de branches esta ativa:
- `dodo/main` -> producao com blindagens
- `upstream` -> espelho limpo do upstream

---

## 4. PRE-MERGE OBRIGATORIO -- Backup de Arquivos Locais

> **NUNCA PULE ESTA ETAPA.**
>
> Arquivos em `.gitignore` **NAO sao restaurados pelo `git reset`** mesmo que tenham existido em commits anteriores.
>
> **INCIDENTE 24/09/2026:** O merge do upstream v1.3.5 apagou fisicamente `manager.ps1`, todos os `.bat`, a pasta `docs/` Dodo e `graphify-out/`. O `git reset` que desfez o merge ruim simplesmente ignorou esses arquivos -- eles precisaram ser recuperados manualmente do historico do git (commit `32e5899`). Se o backup da Secao 4 tivesse sido feito, a recuperacao seria imediata.

### Por que esses arquivos sao vulneraveis?

Os seguintes arquivos sao **untracked** (estao no `.gitignore`) e **invisiveis ao git**:

```
*.bat                  -- Iniciar_QwenBridge.bat, Parar_QwenBridge.bat, QwenBridge.bat
manager.ps1            -- Script de gerenciamento do proxy
_contexto-ia/          -- Geral.md, Commit.md (diretivas Dodo)
docs/                  -- GUIA-MERGE-DODO.md, GUIA-DEPLOY, RELATORIOS, etc.
graphify-out/          -- Mapa de dependencias do projeto
resumo-de-trabalho.md  -- Historico de blindagens
```

**Qualquer operacao git que modifique o working tree pode apaga-los sem aviso e sem possibilidade de `git reset` restaurar.**

---

### Passo 4.1 -- Tirar Snapshot ANTES de qualquer coisa

Execute este bloco **no PowerShell, dentro da pasta de producao**, antes de qualquer `git checkout` ou `robocopy`:

```powershell
$prod = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge"
$backup = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\_backup-pre-merge-$(Get-Date -Format 'yyyy-MM-dd_HH-mm')"

Write-Host "Criando backup em: $backup"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$itens = @(
    "_contexto-ia",
    "docs",
    "graphify-out",
    "resumo-de-trabalho.md",
    "manager.ps1",
    "Iniciar_QwenBridge.bat",
    "Parar_QwenBridge.bat",
    "QwenBridge.bat",
    ".env"
)

foreach ($item in $itens) {
    $src = Join-Path $prod $item
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $backup $item) -Recurse -Force
        Write-Host "OK: $item"
    } else {
        Write-Host "AUSENTE (ignorado): $item"
    }
}

Write-Host "`nBackup concluido em: $backup"
```

---

### Passo 4.2 -- Verificar integridade dos arquivos criticos ANTES

```powershell
$prod = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge"
$criticos = @(
    "_contexto-ia\Geral.md",
    "_contexto-ia\Commit.md",
    "resumo-de-trabalho.md",
    "docs\GUIA-MERGE-DODO.md",
    "manager.ps1",
    "Iniciar_QwenBridge.bat",
    "Parar_QwenBridge.bat",
    "QwenBridge.bat"
)
Write-Host "=== INTEGRIDADE PRE-MERGE ==="
foreach ($f in $criticos) {
    $p = Join-Path $prod $f
    if (Test-Path $p) {
        $kb = [math]::Round((Get-Item $p).Length / 1KB, 1)
        Write-Host "OK [$kb KB]: $f"
    } else {
        Write-Host "AUSENTE: $f --- INTERROMPA O MERGE E RECUPERE ANTES DE CONTINUAR (ver Secao 9)"
    }
}
```

**Se qualquer arquivo aparecer como AUSENTE -> pare, recupere (Secao 9) e so entao continue.**

---

## 5. Fluxo de Atualizacao -- Passo a Passo

> Este e o fluxo que voce seguira **a cada nova atualizacao** do upstream.
> **Execute sempre a Secao 4 antes de comecar aqui.**

---

### ETAPA 1 -- Atualizar o branch `upstream` com a versao nova

Voce baixou os arquivos do upstream novo na pasta `D:\...\qwenproxy-att\qwenproxy_john` (como sempre).

```powershell
# 1. Vai para o branch espelho limpo
git checkout upstream

# 2. Copia os arquivos novos por cima
# ATENCAO: o robocopy abaixo NUNCA deve tocar em _contexto-ia/, docs/, graphify-out/, *.bat, manager.ps1
robocopy "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy_john" "." /E /XD ".git" "node_modules" "data" "data-test" "qwen_profiles" "_contexto-ia" "docs" "graphify-out" "web" /XF ".env" ".env.test" "resumo-de-trabalho.md" "alteracoes-dodo.md" "manager.ps1" "*.bat" "*.ps1"

# 3. Veja o que mudou -- CONFIRME que nenhum arquivo Dodo apareceu aqui
git status
git diff --stat HEAD

# 4. Commita a versao upstream limpa
git add -A
git commit -m "upstream: atualizacao vX.X.X (DD/MM/AAAA)"
```

> **Verificacao obrigatoria apos o `git status`:** Se aparecer qualquer um destes arquivos como modificado/deletado, **PARE IMEDIATAMENTE** e NAO faca o commit:
> - `_contexto-ia/` qualquer arquivo
> - `docs/` qualquer arquivo
> - `manager.ps1`
> - `*.bat`
> - `resumo-de-trabalho.md`
> - `graphify-out/` qualquer arquivo

---

### ETAPA 2 -- Mergear no `dodo/main`

```powershell
# 1. Volta para producao
git checkout dodo/main

# Verificacao imediata pos-checkout -- OBRIGATORIA:
Test-Path "_contexto-ia\Geral.md"
Test-Path "manager.ps1"
Test-Path "Iniciar_QwenBridge.bat"
# Todos devem retornar True. Se algum retornar False -> PARE, use a Secao 9.

# 2. Inicia o merge
git merge upstream
```

**Cenario A -- Merge limpo (sem conflitos):**
```
Merge made by the 'ort' strategy.
 src/services/playwright.ts | 12 +++---
 package.json               |  2 +-
```
Verifique os arquivos locais novamente e pule para a Etapa 3.

**Cenario B -- Conflitos detectados:**
```
CONFLICT (content): Merge conflict in src/routes/chat/streaming.ts
Automatic merge failed; fix conflicts and then commit the result.
```
Va para a Secao 6.

---

### ETAPA 3 -- Checklist de Sobrevivencia

Mesmo em merges limpos, **sempre verifique** os pontos criticos. Ver Secao 7.

---

### ETAPA 4 -- Finalizar e registrar

```powershell
# Commita o merge (se ainda nao foi commitado)
git add -A
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"

# Envia para o remoto
git push origin dodo/main

# Instala dependencias novas se o package.json mudou
npm install
```

---

## 6. Resolvendo Conflitos Git

Quando ha conflitos, o Git marca os arquivos com blocos como este:

```typescript
<<<<<<< dodo/main
  // BLINDAGEM DODO: timeout reduzido para 45s
  const STREAM_READ_TIMEOUT_MS = 45_000;
=======
  // Upstream: timeout padrao de 120s
  const STREAM_READ_TIMEOUT_MS = 120_000;
>>>>>>> upstream
```

### Como resolver:

1. **Abra o arquivo** no VS Code (ele detecta conflitos automaticamente com botoes inline)
2. **Leia os dois lados** -- o `dodo/main` (nosso) e o `upstream` (deles)
3. **Decida o que fica:**
   - Se for uma blindagem Dodo -> **Accept Current Change** (mantem o nosso)
   - Se for funcionalidade nova que nao colide -> **Accept Incoming Change** (pega o upstream)
   - Se precisamos de ambos -> **Accept Both Changes** e ajuste manualmente
4. Salva o arquivo

### Apos resolver todos os conflitos:

```powershell
# Verifica se ainda tem arquivos em conflito
git diff --check

# Adiciona os arquivos resolvidos e commita
git add -A
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
```

---

## 7. Checklist de Sobrevivencia Pos-Merge

> Execute apos **todo merge**, mesmo que tenha sido limpo (sem conflitos).
> Conflitos limpos nao significam que o merge foi semanticamente correto.

---

### 0. Arquivos Locais Untracked -- VERIFICAR PRIMEIRO (CRITICO)

```powershell
$prod = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge"
$criticos = @(
    "_contexto-ia\Geral.md", "_contexto-ia\Commit.md",
    "resumo-de-trabalho.md", "docs\GUIA-MERGE-DODO.md",
    "manager.ps1", "Iniciar_QwenBridge.bat", "Parar_QwenBridge.bat", "QwenBridge.bat"
)
foreach ($f in $criticos) {
    $p = Join-Path $prod $f
    if (Test-Path $p) { Write-Host "OK: $f" } else { Write-Host "PERDIDO: $f" }
}
```
**Todos devem mostrar OK.** Se algum mostrar PERDIDO -> ver Secao 9.

---

### 1. Telemetria do Dashboard -- `src/api/server.ts`

```powershell
Select-String "ram_mb|stream_errors|cooldown_until|cooldown_reason" src/api/server.ts
```
**Deve retornar linhas.** Se nao -> reinjetar o `accountsHandler`.

---

### 2. Dimensionamento de Janelas -- `src/services/playwright.ts`

```powershell
Select-String "width: 800" src/services/playwright.ts
```
**Deve retornar ao menos 2 ocorrencias** (viewport + screen).

---

### 3. Minimizacao Automatica -- `src/services/playwright.ts`

```powershell
Select-String "minimizeWindow" src/services/playwright.ts
```
**Deve retornar ao menos 1 linha.**

---

### 4. NaN Guard no Posicionamento -- `src/services/playwright.ts`

```powershell
Select-String "isNaN" src/services/playwright.ts
```
**Deve retornar ao menos 1 linha.**

---

### 5. STREAM_READ_TIMEOUT_MS -- `src/routes/chat/streaming.ts`

```powershell
Select-String "STREAM_READ_TIMEOUT_MS" src/routes/chat/streaming.ts
```
**O valor deve ser `45_000`** (upstream usa 120_000 -- sempre reduzir).

---

### 6. Script de Inicializacao -- `package.json`

```powershell
Select-String "start:qwenbridge" package.json
```
**Deve retornar:** `"start:qwenbridge": "npx tsx src/index.ts"`

---

### 7. Try-Catch com Timeout no `page.focus` -- `src/services/playwright.ts`

```powershell
Select-String "timeout: 5000" src/services/playwright.ts
```
**Deve retornar ao menos 1 linha.**

---

### 8. Acumulacao por Arrays (GC) -- `src/routes/chat/streaming.ts`

```powershell
Select-String "finalContentChunks|reasoningChunks" src/routes/chat/streaming.ts
```
**Deve retornar linhas com `.push()` e `.join`** (nunca `+=`).

---

### 9. Metricas de Token -- `src/routes/chat/streaming.ts`

```powershell
Select-String "recordAccountTokens" src/routes/chat/streaming.ts
```
**Deve retornar ao menos 1 linha.**

---

### 10. DELETE de Contas Fantasmas -- `src/core/accounts.ts`

```powershell
Select-String "DELETE FROM accounts WHERE email NOT IN" src/core/accounts.ts
```
**Deve retornar ao menos 1 linha.**

---

### 11. Idle Memory Cleaner -- `src/services/playwright.ts`

```powershell
Select-String "accountLastActivity|setInterval" src/services/playwright.ts
```
**Deve retornar linhas.**

---

### 12. Rota Anthropic -- `src/routes/anthropic/`

```powershell
Test-Path src/routes/anthropic/translate.ts
```
**Deve retornar `True`.**

---

### 13. Alias de Modelos 1M -- `src/api/models.ts`

```powershell
Select-String "1M" src/api/models.ts
```
**Deve retornar ao menos 1 linha.**

---

### 14. Cache SQLite Reduzido -- `src/core/database.ts`

```powershell
Select-String "cache_size" src/core/database.ts
```
**Deve retornar:** `-8000`

---

### 15. Painel Web SPA Admin & Rota `/admin` -- `web/` e `src/api/admin.ts`

```powershell
Select-String "adminApp" src/api/server.ts
```
- A sub-aplicacao `adminApp` deve estar montada em `/admin`.
- A pasta `web/` (React + Vite + shadcn) e seus assets pre-compilados em `web/dist/` devem estar presentes.
- O `package.json` deve conter `"build:admin": "npm --prefix web run build"`.
- O endpoint `GET /admin/api/overview` em `src/api/admin.ts` deve fornecer metricas planas (`requestsTotal`, `requestsCompletions`, `requestsErrors`, `memory`, `accounts`, `users`).

---

### 16. Scripts de Execucao Autonomos (`.bat`) & Integracao CaptchaResolve

- `Iniciar_QwenBridge.bat`: Deve iniciar o `CaptchaResolve` (porta 50006) em segundo plano, o `QwenBridge` (porta 50002) diretamente na janela do terminal e abrir `http://127.0.0.1:50002/admin` no navegador.
- `Parar_QwenBridge.bat`: Deve encerrar os processos nas portas 50002 e 50006.
- O `.gitignore` deve manter `*.bat`, `docs/` e `_contexto-ia/` ignorados para nao expor caminhos locais no GitHub.

---

### 17. Degenerate Answer Guard & Inlining de Codigo -- `src/utils/` e `src/routes/`

```powershell
Test-Path src/utils/degenerate-answer.ts
```
- `isDegenerateAnswer()` deve estar ativo com hold buffer (800B) no streaming em `src/routes/chat/streaming.ts`.
- `processImagesForQwen()` em `src/routes/upload.ts` deve fazer inlining de arquivos de texto/codigo (`.txt`, `.py`, `.ts`, `.json`, `.csv`, `.md`, etc.) diretamente no prompt via `[File: name]`, sem upload binario para o OSS.
- `fixEqualsSeparators()` em `src/utils/json.ts` deve tratar argumentos com `=`.

---

## 8. Rollback de Emergencia

```powershell
# Ver historico recente
git log --oneline -10

# Voltar para o commit anterior ao merge (substitua HASH pelo commit ANTES do merge)
git reset --hard HASH

# ATENCAO: git reset NAO restaura arquivos untracked (.gitignore)
# Se os arquivos locais sumiram, use a Secao 9 IMEDIATAMENTE apos o reset.

# Apos verificar que os arquivos locais voltaram:
git push origin dodo/main --force
```

---

## 9. Recuperacao de Arquivos Untracked Perdidos

> **Documentado a partir do incidente de 24/09/2026.**
> O merge do upstream v1.3.5 apagou fisicamente os arquivos untracked mesmo apos o `git reset`.

### Por que acontece?

O `git reset --hard` restaura apenas arquivos **rastreados** pelo git. Arquivos em `.gitignore` sao invisiveis ao git e nao sao restaurados automaticamente.

### Fonte 1: commits git (preferencial)

Mesmo sendo untracked no HEAD, esses arquivos podem ter sido **commitados acidentalmente** em algum ponto do historico. Para encontrar e extrair:

```powershell
# Descobrir em qual commit o arquivo apareceu pela ultima vez
git log --all --diff-filter=A --name-only --pretty="format:COMMIT:%H %s" | Select-String "manager.ps1|Parar_QwenBridge|\.bat|GUIA-DEPLOY|GRAPH_REPORT"

# Extrair um arquivo especifico de um commit (nao afeta HEAD nem index)
git show "HASH:caminho/do/arquivo.ext" | Set-Content -Path "caminho/do/arquivo.ext" -Encoding UTF8
```

Referencia do incidente (commit `32e5899` continha todos os arquivos Dodo):

```powershell
git show "32e5899:manager.ps1"                               | Set-Content -Path "manager.ps1" -Encoding UTF8
git show "32e5899:Parar_QwenBridge.bat"                      | Set-Content -Path "Parar_QwenBridge.bat" -Encoding UTF8
git show "32e5899:QwenBridge.bat"                            | Set-Content -Path "QwenBridge.bat" -Encoding UTF8
git show "32e5899:Iniciar_QwenBridge.bat"                    | Set-Content -Path "Iniciar_QwenBridge.bat" -Encoding UTF8
git show "32e5899:resumo-de-trabalho.md"                     | Set-Content -Path "resumo-de-trabalho.md" -Encoding UTF8
git show "32e5899:_contexto-ia/Commit.md"                    | Set-Content -Path "_contexto-ia/Commit.md" -Encoding UTF8
git show "32e5899:docs/GUIA-MERGE-DODO.md"                   | Set-Content -Path "docs/GUIA-MERGE-DODO.md" -Encoding UTF8
git show "32e5899:docs/GUIA-DEPLOY-VPS-CONTABO.md"           | Set-Content -Path "docs/GUIA-DEPLOY-VPS-CONTABO.md" -Encoding UTF8
git show "32e5899:docs/MANUAL-COMANDOS-VPS-LINUX.md"         | Set-Content -Path "docs/MANUAL-COMANDOS-VPS-LINUX.md" -Encoding UTF8
git show "32e5899:graphify-out/GRAPH_REPORT.md"              | Set-Content -Path "graphify-out/GRAPH_REPORT.md" -Encoding UTF8
```

> **Atencao ao `_contexto-ia/Geral.md`:** Este arquivo nunca teve uma versao valida no git -- o historico contem apenas um dump JSON de modelos da API commitado por engano. A versao correta existe **apenas no Historico de Versoes do OneDrive**: Explorer -> botao direito -> "Historico da versao".

### Fonte 2: backup pre-merge (Secao 4)

Se o backup da Secao 4 foi feito:

```powershell
$backup = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\_backup-pre-merge-YYYY-MM-DD_HH-mm"
$prod = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge"

Copy-Item "$backup\_contexto-ia" "$prod\_contexto-ia" -Recurse -Force
Copy-Item "$backup\docs"         "$prod\docs"         -Recurse -Force
Copy-Item "$backup\manager.ps1"  "$prod\manager.ps1"  -Force
Copy-Item "$backup\*.bat"        "$prod\"              -Force
Write-Host "Restaurado do backup."
```

---

## 10. Referencia Rapida de Comandos

### Fluxo de update completo (resumo executivo)

```powershell
# -- PRE-MERGE: Backup obrigatorio (Secao 4) --
$prod = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge"
$backup = "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\_backup-pre-merge-$(Get-Date -Format 'yyyy-MM-dd_HH-mm')"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
@("_contexto-ia","docs","graphify-out","resumo-de-trabalho.md","manager.ps1","Iniciar_QwenBridge.bat","Parar_QwenBridge.bat","QwenBridge.bat",".env") | ForEach-Object { if (Test-Path "$prod\$_") { Copy-Item "$prod\$_" "$backup\$_" -Recurse -Force } }
Write-Host "Backup feito: $backup"

# -- ETAPA 1: Atualiza espelho upstream --
git checkout upstream
robocopy "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy_john" "." /E /XD ".git" "node_modules" "data" "data-test" "qwen_profiles" "_contexto-ia" "docs" "graphify-out" "web" /XF ".env" ".env.test" "resumo-de-trabalho.md" "alteracoes-dodo.md" "manager.ps1" "*.bat" "*.ps1"
git add -A; git commit -m "upstream: vX.X.X"
git push origin upstream

# -- ETAPA 2: Mergea na producao --
git checkout dodo/main
Test-Path "_contexto-ia\Geral.md"; Test-Path "manager.ps1"; Test-Path "Iniciar_QwenBridge.bat"
git merge upstream

# -- ETAPA 3: Resolve conflitos (se houver) -> ver Secao 6 --

# -- ETAPA 4: Executa checklist -> ver Secao 7 --

# -- ETAPA 5: Finaliza --
git add -A; git commit -m "merge: vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
git push origin dodo/main
npm install
```

### Inspecionar diferencas entre branches

```powershell
# Arquivos que diferem entre upstream e dodo/main
git diff upstream dodo/main --name-only

# Diff completo de um arquivo especifico
git diff upstream dodo/main -- src/services/playwright.ts
```

---

> **Lembre-se:** O `resumo-de-trabalho.md` na raiz do projeto e a pasta `_contexto-ia/` (`Geral.md`, `Commit.md`) sao os registros historicos de **o que** e **por que** cada blindagem existe. Este guia e o **como** executar o merge de forma segura. **Todos devem ser preservados e verificados a cada merge** -- use sempre o backup da Secao 4.
