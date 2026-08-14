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

> ⚠️ **Este setup só precisa ser feito uma vez.** Depois disso, apenas siga o [Fluxo de Atualização](#4-fluxo-de-atualização--passo-a-passo).

Abra o terminal dentro da pasta de produção:

```
D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge
```

### Passo 1 — Verificar em qual branch você está

```powershell
git branch
```

Você deve estar no branch principal (provavelmente `main` ou `master`). Este vai se tornar o `dodo/main`.

### Passo 2 — Renomear o branch atual para `dodo/main`

```powershell
git branch -m dodo/main
```

### Passo 3 — Criar o branch `upstream` a partir do estado atual

Neste momento, seu `dodo/main` já tem nossas blindagens. Precisamos criar um branch `upstream` que represente o estado **limpo do upstream** (sem nossas customizações). Você tem duas opções:

**Opção A — Se tiver a pasta do upstream baixada localmente (situação mais comum):**

```powershell
# Cria o branch upstream a partir do dodo/main (ponto de partida)
git checkout -b upstream

# Agora copie os arquivos do upstream puro por cima
# (usando o diretório qwenbridge-att que você baixou)
# ATENÇÃO: não sobrescreva .env, .git, data/, qwen_profiles/

# Faça commit do estado upstream limpo
git add -A
git commit -m "chore: estado inicial upstream (pré-blindagens Dodo)"

# Volta para produção
git checkout dodo/main
```

**Opção B — Se tiver acesso ao repositório Git original do upstream:**

```powershell
# Adiciona o remote do upstream
git remote add upstream https://github.com/OWNER/qwenbridge.git

# Cria o branch upstream rastreando o remoto
git checkout -b upstream upstream/main

# Volta para produção
git checkout dodo/main
```

### Passo 4 — Confirmar a estrutura

```powershell
git branch
# Deve mostrar:
# * dodo/main
#   upstream
```

**Setup concluído. ✅**

---

## 4. Fluxo de Atualização — Passo a Passo

> Este é o fluxo que você seguirá **a cada nova atualização** do upstream.

---

### 🔵 ETAPA 1 — Atualizar o branch `upstream` com a versão nova

Você baixou os arquivos do upstream novo localmente (ex: `D:\...\qwenproxy-att\qwenbridge`).

```powershell
# 1. Vai para o branch espelho limpo
git checkout upstream

# 2. Copia os arquivos novos por cima
#    (substitua o caminho abaixo pelo diretório correto do download)
xcopy /E /Y /I "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenbridge\*" "."

# 3. Reverte arquivos que NUNCA devem vir do upstream
git checkout -- .env
git checkout -- data/
git checkout -- qwen_profiles/

# 4. Veja o que mudou
git status
git diff --stat HEAD

# 5. Commita a versão upstream limpa
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
 ...
```
O Git conseguiu integrar tudo automaticamente. Pule para a [Etapa 3](#-etapa-3--checklist-de-sobrevivência).

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

# Instala dependências novas se o package.json mudou
npm install
```

---

## 5. Resolvendo Conflitos Git

Quando há conflitos, o Git marca os arquivos com blocos como este:

```typescript
<<<<<<< dodo/main
  // 🛡️ BLINDAGEM DODO: timeout reduzido para 45s (evita silêncio antes do timeout do cliente)
  const STREAM_READ_TIMEOUT_MS = 45_000;
=======
  // Upstream: timeout padrão de 120s
  const STREAM_READ_TIMEOUT_MS = 120_000;
>>>>>>> upstream
```

### Como resolver:

1. **Abra o arquivo** no editor (VS Code detecta conflitos automaticamente)
2. **Leia os dois lados** — o `dodo/main` (nosso) e o `upstream` (deles)
3. **Decida o que fica:**
   - Se for uma blindagem Dodo → **mantém o nosso**
   - Se for uma funcionalidade nova que não colide → **mantém o upstream**
   - Se colide mas precisamos de ambos → **funde manualmente** os dois blocos
4. **Delete as marcações** `<<<<<<<`, `=======`, `>>>>>>>`
5. Salva o arquivo

### Após resolver todos os conflitos:

```powershell
# Verifica se ainda tem arquivos em conflito
git diff --check

# Adiciona os arquivos resolvidos
git add -A

# Commita
git commit -m "merge: upstream vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
```

### Dica — Usar VS Code para resolver conflitos:

O VS Code exibe botões inline:
- **Accept Current Change** → Mantém o nosso (`dodo/main`)
- **Accept Incoming Change** → Pega o do upstream
- **Accept Both Changes** → Inclui os dois (útil para adicionar uma função nova sem remover a nossa)
- **Compare Changes** → Exibe um diff lado a lado

---

## 6. Checklist de Sobrevivência Pós-Merge

> Execute este checklist após **todo merge**, mesmo que tenha sido limpo (sem conflitos).  
> Conflitos limpos não significam que o merge foi semanticamente correto.

---

### ☑️ 1. Telemetria do Dashboard (Tauri) — `src/api/server.ts`

**Verificar:** O endpoint `GET /accounts` retorna as chaves completas do Dodo?

```powershell
# Busca as chaves que o Proxy Launcher precisa
grep -n "ram_mb|stream_errors|cooldown_until|cooldown_reason" src/api/server.ts
```

**Deve retornar linhas.** Se não retornar → reinjetar o `accountsHandler` completo (ver Fase 4 do `alterações-dodo.md`).

---

### ☑️ 2. Dimensionamento de Janelas — `src/services/playwright.ts`

**Verificar:** O `launchPersistentContext` tem `viewport: { width: 800, height: 800 }` e `screen: { width: 800, height: 800 }` forçados?

```powershell
grep -n "width: 800" src/services/playwright.ts
```

**Deve retornar ao menos 2 ocorrências** (viewport + screen).

---

### ☑️ 3. Minimização Automática — `src/services/playwright.ts`

**Verificar:** A chamada `await minimizeWindow(acctPage)` existe após a captura de headers?

```powershell
grep -n "minimizeWindow" src/services/playwright.ts
```

**Deve retornar ao menos 1 linha.**

---

### ☑️ 4. NaN Guard no Posicionamento — `src/services/playwright.ts`

**Verificar:** Existe a trava `!isNaN(cx) && !isNaN(cy)` antes de montar os args do Chromium?

```powershell
grep -n "isNaN" src/services/playwright.ts
```

**Deve retornar ao menos 1 linha.**

---

### ☑️ 5. STREAM_READ_TIMEOUT_MS — `src/routes/chat/streaming.ts`

**Verificar:** O timeout está em `45_000` e **não** em `120_000`?

```powershell
grep -n "STREAM_READ_TIMEOUT_MS" src/routes/chat/streaming.ts
```

**O valor deve ser `45_000`.**

---

### ☑️ 6. Script de Inicialização — `package.json`

**Verificar:** O script `start:qwenbridge` existe?

```powershell
grep -n "start:qwenbridge" package.json
```

**Deve retornar:** `"start:qwenbridge": "npx tsx src/index.ts"`

---

### ☑️ 7. Try-Catch com Timeout no `page.focus` — `src/services/playwright.ts`

**Verificar:** O bloco de captura de headers tem `try/catch` com `{ timeout: 5000 }`?

```powershell
grep -n "timeout: 5000" src/services/playwright.ts
```

**Deve retornar ao menos 1 linha.**

---

### ☑️ 8. Acumulação por Arrays (GC) — `src/routes/chat/streaming.ts`

**Verificar:** As variáveis de buffer usam `.push()` + `.join("")` e **não** `+=`?

```powershell
grep -n "finalContentChunks|reasoningChunks" src/routes/chat/streaming.ts
```

**Deve retornar linhas com `.push()` e `.join`.**

---

### ☑️ 9. Métricas de Token — `src/routes/chat/streaming.ts`

**Verificar:** A chamada `recordAccountTokens()` existe no fluxo de finalização?

```powershell
grep -n "recordAccountTokens" src/routes/chat/streaming.ts
```

**Deve retornar ao menos 1 linha.**

---

### ☑️ 10. DELETE de Contas Fantasmas — `src/core/accounts.ts`

**Verificar:** A query de DELETE existe dentro de `syncEnvAccounts()`?

```powershell
grep -n "DELETE FROM accounts WHERE email NOT IN" src/core/accounts.ts
```

**Deve retornar ao menos 1 linha.**

---

### ☑️ 11. Idle Memory Cleaner — `src/services/playwright.ts`

**Verificar:** O `setInterval` de limpeza de contextos ociosos (15 min) existe no arquivo?

```powershell
grep -n "accountLastActivity|setInterval" src/services/playwright.ts
```

**Deve retornar linhas.**

---

### ☑️ 12. Rota Anthropic — `src/routes/anthropic/`

**Verificar:** A pasta e o arquivo `translate.ts` existem?

```powershell
Test-Path src/routes/anthropic/translate.ts
```

**Deve retornar `True`.**

---

### ☑️ 13. Alias de Modelos 1M — `src/api/models.ts`

**Verificar:** Existe lógica para expor variantes `[1M]` dos modelos?

```powershell
grep -n "1M" src/api/models.ts
```

**Deve retornar ao menos 1 linha.**

---

### ☑️ 14. Cache SQLite Reduzido — `src/core/database.ts`

**Verificar:** O PRAGMA `cache_size = -8000` está ativo?

```powershell
grep -n "cache_size" src/core/database.ts
```

**Deve retornar:** `-8000`

---

## 7. Rollback de Emergência

Se após o merge algo quebrou e você precisa voltar imediatamente:

```powershell
# Ver o histórico dos últimos commits
git log --oneline -10

# Voltar para o commit anterior ao merge (substitua HASH pelo hash correto)
git reset --hard HASH

# Alternativa: desfazer apenas o último commit mantendo os arquivos
git reset --soft HEAD~1
```

Para ver o hash do commit antes do merge:

```powershell
git log --oneline --merges -5
# Anote o hash do commit ANTES do merge e use no reset --hard acima
```

---

## 8. Referência Rápida de Comandos

### Verificar estado dos branches

```powershell
git branch            # lista branches
git log --oneline -5  # últimos 5 commits
git status            # arquivos modificados
```

### Fluxo de update completo (resumo executivo)

```powershell
# 1. Atualiza espelho upstream
git checkout upstream
xcopy /E /Y /I "D:\...\qwenproxy-att\qwenbridge\*" "."
git checkout -- .env && git checkout -- data/ && git checkout -- qwen_profiles/
git add -A && git commit -m "upstream: vX.X.X"

# 2. Mergea na produção
git checkout dodo/main
git merge upstream

# 3. Resolve conflitos (se houver) → ver Seção 5

# 4. Executa checklist → ver Seção 6

# 5. Finaliza
git add -A && git commit -m "merge: vX.X.X integrado com blindagens Dodo (DD/MM/AAAA)"
npm install
```

### Inspecionar o que mudou entre branches

```powershell
# Ver arquivos que diferem entre upstream e dodo/main
git diff upstream dodo/main --name-only

# Ver diff completo de um arquivo específico
git diff upstream dodo/main -- src/services/playwright.ts
```

---

> 📌 **Lembre-se:** O `alterações-dodo.md` na raiz do projeto é o registro histórico de **por que** cada blindagem existe. Este guia é o **como** executar o merge de forma segura.  
> Ambos os documentos devem ser lidos em conjunto.
