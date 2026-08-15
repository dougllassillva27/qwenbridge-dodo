# 🔀 Manual de Merge Dodo — QwenBridge

> **Versão:** 1.0 · **Atualizado em:** 14/08/2026  
> **Objetivo:** Garantir que nenhuma blindagem Dodo seja perdida ao integrar atualizações do upstream.

---

## 📖 Índice

1. [O Problema e a Solução](#1-o-problema-e-a-solução)
2. [Visão Geral da Estratégia](#2-visão-geral-da-estratégia)
3. [Setup Inicial — Fazer Uma Única Vez](#3-setup-inicial--fazer-uma-única-vez)
4. [Fluxo de Atualização — Passo a Passo](#4-fluxo-de-atualização--passo-a-passo)
5. [Resolvendo Conflitos Git](#5-resolvendo-conflitos-git)
6. [Checklist de Sobrevivência Pós-Merge](#6-checklist-de-sobrevivência-pós-merge)
7. [Rollback de Emergência](#7-rollback-de-emergência)
8. [Referência Rápida de Comandos](#8-referência-rápida-de-comandos)

---

## 1. O Problema e a Solução

### ❌ Como era antes

Cada atualização do upstream era um processo manual:
- Baixar os arquivos novos
- Comparar visualmente arquivo por arquivo
- Tentar lembrar/reler o `alterações-dodo.md` e reinjetar tudo na mão
- Alta chance de esquecer algo → funcionalidade perdida → remendo pós-update

### ✅ Como é agora

Utilizamos uma **estratégia de dois branches Git**:

| Branch | Dono | Descrição |
|--------|------|-----------|
| `upstream` | Código do dono do projeto | Recebe o upstream puro, **nunca editamos aqui** |
| `dodo/main` | Nosso código de produção | Tem TODAS as blindagens Dodo, é o branch que roda |

Quando chega um update: fazemos `git merge upstream` no `dodo/main`.  
O Git mostra **somente os conflitos reais** — os pontos onde o upstream tocou em algo que também customizamos.  
Isso transforma horas de comparação manual em minutos de revisão focada.

---

## 2. Visão Geral da Estratégia

```
[Upstream Original]
       │
       │ (novo release)
       ▼
[branch: upstream] ── espelho limpo, sem toques Dodo
       │
       │ git merge upstream
       ▼
[branch: dodo/main] ── produção com TODAS as blindagens
       │
       │ (é daqui que o Proxy Launcher roda)
       ▼
[Servidor em Produção]
```

**Regra de ouro:** Nunca edite código no branch `upstream`. Ele deve sempre ser idêntico ao código que o dono do projeto entregou.

---

## 3. Setup Inicial — Fazer Uma Única Vez

> ⚠️ **Este setup já foi executado.** Esta seção existe apenas para referência histórica.

A estrutura de branches está ativa:
- `dodo/main` → produção com blindagens
- `upstream` → espelho limpo do upstream

---

## 4. Fluxo de Atualização — Passo a Passo

> Este é o fluxo que você seguirá **a cada nova atualização** do upstream.

---

### 🔵 ETAPA 1 — Atualizar o branch `upstream` com a versão nova

Você baixou os arquivos do upstream novo na pasta `D:\...\qwenproxy-att\qwenproxy` (como sempre).

```powershell
# 1. Vai para o branch espelho limpo
git checkout upstream

# 2. Copia os arquivos novos por cima (exclui o que não deve vir do upstream)
robocopy "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy" "." /E /XD ".git" "node_modules" "data" "qwen_profiles" "data-test" "_contexto-ia" /XF ".env" "resumo-de-trabalho.md"

# 3. Veja o que mudou
git status
git diff --stat HEAD

# 4. Commita a versão upstream limpa
git add -A
git commit -m "upstream: atualização vX.X.X (DD/MM/AAAA)"
```

---

### 🟢 ETAPA 2 — Mergear no `dodo/main`

```powershell
# 1. Volta para produção
git checkout dodo/main

# 2. Inicia o merge
git merge upstream
```

**Cenário A — Merge limpo (sem conflitos):**
```
Merge made by the 'ort' strategy.
 src/services/playwright.ts | 12 +++---
 package.json               |  2 +-
```
O Git conseguiu integrar tudo automaticamente. Pule para a Etapa 3.

**Cenário B — Conflitos detectados:**
```
CONFLICT (content): Merge conflict in src/routes/chat/streaming.ts
CONFLICT (content): Merge conflict in src/services/playwright.ts
Automatic merge failed; fix conflicts and then commit the result.
```
Vá para a [Seção 5 — Resolvendo Conflitos](#5-resolvendo-conflitos-git).

---

### 🟡 ETAPA 3 — Checklist de Sobrevivência

Mesmo em merges limpos, **sempre verifique** os pontos críticos. Ver [Seção 6](#6-checklist-de-sobrevivência-pós-merge).

---

### ✅ ETAPA 4 — Finalizar e registrar

```powershell
# Commita o merge (se ainda não foi commitado)
git add -A
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"

# Envia para o remoto
git push origin dodo/main

# Instala dependências novas se o package.json mudou
npm install
```

---

## 5. Resolvendo Conflitos Git

Quando há conflitos, o Git marca os arquivos com blocos como este:

```typescript
<<<<<<< dodo/main
  // 🛡️ BLINDAGEM DODO: timeout reduzido para 45s
  const STREAM_READ_TIMEOUT_MS = 45_000;
=======
  // Upstream: timeout padrão de 120s
  const STREAM_READ_TIMEOUT_MS = 120_000;
>>>>>>> upstream
```

### Como resolver:

1. **Abra o arquivo** no VS Code (ele detecta conflitos automaticamente com botões inline)
2. **Leia os dois lados** — o `dodo/main` (nosso) e o `upstream` (deles)
3. **Decida o que fica:**
   - Se for uma blindagem Dodo → **Accept Current Change** (mantém o nosso)
   - Se for funcionalidade nova que não colide → **Accept Incoming Change** (pega o upstream)
   - Se precisamos de ambos → **Accept Both Changes** e ajuste manualmente
4. Salva o arquivo

### Após resolver todos os conflitos:

```powershell
# Verifica se ainda tem arquivos em conflito
git diff --check

# Adiciona os arquivos resolvidos e commita
git add -A
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
```

---

## 6. Checklist de Sobrevivência Pós-Merge

> Execute após **todo merge**, mesmo que tenha sido limpo (sem conflitos).  
> Conflitos limpos não significam que o merge foi semanticamente correto.

---

### ☑️ 1. Telemetria do Dashboard (Tauri) — `src/api/server.ts`

```powershell
grep -n "ram_mb|stream_errors|cooldown_until|cooldown_reason" src/api/server.ts
```
**Deve retornar linhas.** Se não → reinjetar o `accountsHandler` (ver Fase 4 do `alterações-dodo.md`).

---

### ☑️ 2. Dimensionamento de Janelas — `src/services/playwright.ts`

```powershell
grep -n "width: 800" src/services/playwright.ts
```
**Deve retornar ao menos 2 ocorrências** (viewport + screen).

---

### ☑️ 3. Minimização Automática — `src/services/playwright.ts`

```powershell
grep -n "minimizeWindow" src/services/playwright.ts
```
**Deve retornar ao menos 1 linha.**

---

### ☑️ 4. NaN Guard no Posicionamento — `src/services/playwright.ts`

```powershell
grep -n "isNaN" src/services/playwright.ts
```
**Deve retornar ao menos 1 linha.**

---

### ☑️ 5. STREAM_READ_TIMEOUT_MS — `src/routes/chat/streaming.ts`

```powershell
grep -n "STREAM_READ_TIMEOUT_MS" src/routes/chat/streaming.ts
```
**O valor deve ser `45_000`** (upstream usa 120_000 — sempre reduzir).

---

### ☑️ 6. Script de Inicialização — `package.json`

```powershell
grep -n "start:qwenbridge" package.json
```
**Deve retornar:** `"start:qwenbridge": "npx tsx src/index.ts"`

---

### ☑️ 7. Try-Catch com Timeout no `page.focus` — `src/services/playwright.ts`

```powershell
grep -n "timeout: 5000" src/services/playwright.ts
```
**Deve retornar ao menos 1 linha.**

---

### ☑️ 8. Acumulação por Arrays (GC) — `src/routes/chat/streaming.ts`

```powershell
grep -n "finalContentChunks|reasoningChunks" src/routes/chat/streaming.ts
```
**Deve retornar linhas com `.push()` e `.join`** (nunca `+=`).

---

### ☑️ 9. Métricas de Token — `src/routes/chat/streaming.ts`

```powershell
grep -n "recordAccountTokens" src/routes/chat/streaming.ts
```
**Deve retornar ao menos 1 linha.**

---

### ☑️ 10. DELETE de Contas Fantasmas — `src/core/accounts.ts`

```powershell
grep -n "DELETE FROM accounts WHERE email NOT IN" src/core/accounts.ts
```
**Deve retornar ao menos 1 linha.**

---

### ☑️ 11. Idle Memory Cleaner — `src/services/playwright.ts`

```powershell
grep -n "accountLastActivity|setInterval" src/services/playwright.ts
```
**Deve retornar linhas.**

---

### ☑️ 12. Rota Anthropic — `src/routes/anthropic/`

```powershell
Test-Path src/routes/anthropic/translate.ts
```
**Deve retornar `True`.**

---

### ☑️ 13. Alias de Modelos 1M — `src/api/models.ts`

```powershell
grep -n "1M" src/api/models.ts
```
**Deve retornar ao menos 1 linha.**

---

### ☑️ 14. Cache SQLite Reduzido — `src/core/database.ts`

```powershell
grep -n "cache_size" src/core/database.ts
```
**Deve retornar:** `-8000`

---

## 7. Rollback de Emergência

```powershell
# Ver histórico recente
git log --oneline -10

# Voltar para o commit anterior ao merge (substitua HASH)
git reset --hard HASH

# Empurrar o rollback para o remoto
git push origin dodo/main --force
```

---

## 8. Referência Rápida de Comandos

### Fluxo de update completo (resumo executivo)

```powershell
# 1. Atualiza espelho upstream
git checkout upstream
robocopy "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy" "." /E /XD ".git" "node_modules" "data" "qwen_profiles" /XF ".env"
git add -A; git commit -m "upstream: vX.X.X"
git push origin upstream

# 2. Mergea na produção
git checkout dodo/main
git merge upstream

# 3. Resolve conflitos (se houver) → ver Seção 5

# 4. Executa checklist → ver Seção 6

# 5. Finaliza
git add -A; git commit -m "merge: vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
git push origin dodo/main
npm install
```

### Inspecionar diferenças entre branches

```powershell
# Arquivos que diferem entre upstream e dodo/main
git diff upstream dodo/main --name-only

# Diff completo de um arquivo específico
git diff upstream dodo/main -- src/services/playwright.ts
```

---

> 📌 **Lembre-se:** O `alterações-dodo.md` na raiz do projeto é o registro histórico de **por que** cada blindagem existe. Este guia é o **como** executar o merge de forma segura. Ambos devem ser lidos em conjunto.
