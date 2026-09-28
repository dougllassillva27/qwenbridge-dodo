; ============================================================
; HOTKEYS DE MANUTENÇÃO DODO — QwenBridge
; Versão: 2.1  |  Atualizado: 25/09/2026
; Arquivo: _contexto-ia/hotkeys-merge.ahk
;
; Atalhos disponíveis:
;   --- AMBIENTE LOCAL (WINDOWS) ---
;   \att bridge  →  Mensagem completa de início de merge local
;   \ok merge    →  Frase de aprovação do relatório de merge
;   \emg merge   →  Frase de rollback de emergência local
;
;   --- AMBIENTE VPS (LINUX / DOCKER) ---
;   \att vps     →  Prompt seguro para atualização da VPS (GitHub dodo/main)
;   \ok vps      →  Frase de aprovação para execução do update na VPS
;   \emg vps     →  Frase e procedimento de rollback de emergência na VPS
; ============================================================


; ############################################################
; SEÇÃO 1: AMBIENTE LOCAL (WINDOWS)
; ############################################################

; ============================================================
; INÍCIO DE MERGE LOCAL
; Atalho: \att bridge
; ============================================================

:*:\att bridge::
    ClipboardBackup := ClipboardAll
    Clipboard =
    ( LTrim
🔀 INÍCIO DE MERGE DODO — PROTOCOLO GIT STRATEGY 🔀

Temos uma nova atualização (Upstream) do repositório oficial do `qwenbridge`.
Eu **já baixei** os arquivos localmente em `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy_john`.
Não tente usar git clone ou acessar a internet.

📂 **Diretórios Mapeados:**
- **Nova Versão (Upstream — Referência):** `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy_john`
- **Nossa Produção (Destino / branch dodo/main):** `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge`

📄 **Documentos de Referência Obrigatória (leia antes de qualquer ação):**
- Manifesto e histórico de blindagens: `resumo-de-trabalho.md` (raiz da produção)
- Contexto e diretrizes Dodo: `_contexto-ia/Geral.md` e `_contexto-ia/Commit.md`
- Manual de merge + checklist (incluindo Painel Web e .bat): `docs/GUIA-MERGE-DODO.md`

🗒️ **Contexto desta Atualização:**
- Versão upstream anterior: [EX: v1.3.5 ou commit hash]
- Versão upstream nova: [EX: v1.4.0 ou commit hash]
- Mudanças conhecidas neste update (se souber): [DESCREVA OU ESCREVA "Desconhecido"]

✅ **Confirmação Pré-Merge (preencha VOCÊ antes de enviar):**
- [ ] Backup dos arquivos locais feito em: `_backup-pre-merge-[DATA-HORA]`
- [ ] Verificação de integridade executada (Seção 4.2 do GUIA): todos os arquivos críticos presentes

📜 **Regras Absolutas — Fase de Análise (NÃO EDITE NADA AINDA):**
1. Leia OBRIGATORIAMENTE o `resumo-de-trabalho.md`, `_contexto-ia/Geral.md`, `_contexto-ia/Commit.md` e o `docs/GUIA-MERGE-DODO.md` (especialmente a Seção 4) antes de qualquer ação.
2. As blindagens Dodo e a documentação local são sagradas. O upstream se adapta a elas, nunca o contrário.
3. Os arquivos untracked (*.bat, manager.ps1, docs/, _contexto-ia/, graphify-out/) são INVISÍVEIS ao git e podem ser apagados sem aviso. Nunca execute git clean, git checkout -- . ou operações destrutivas sem confirmar comigo.
4. Sua primeira tarefa é **puramente de análise e comparação** entre os dois diretórios.
5. Crie um **Relatório de Análise de Diferenças** em Markdown contendo:
   a) O que mudou no upstream (arquivos, funções, comportamentos novos/removidos)
   b) Quais dos 17 pontos do checklist (Seção 7 do GUIA, incluindo rotas do Launcher, Painel Web Admin, scripts .bat e Guards) estão em risco de colisão
   c) Seu plano exato, passo a passo, para executar o merge preservando as blindagens e a integridade de todos os arquivos locais (incluindo os untracked)

Aguardo o relatório. Somente após minha aprovação você terá permissão para editar qualquer arquivo de produção.
    )
    ClipWait, 1
    if (ErrorLevel) {
        Clipboard := ClipboardBackup
        ClipboardBackup := ""
        return
    }
    SendInput, ^v
    Sleep, 100
    Clipboard := ClipboardBackup
    ClipboardBackup := ""
return

; ============================================================
; FRASE DE APROVAÇÃO RÁPIDA LOCAL
; Atalho: \ok merge
; ============================================================

:*:\ok merge::
    ClipboardBackup := ClipboardAll
    Clipboard =
    ( LTrim
✅ Relatório aprovado. Pode iniciar o merge seguindo o plano exato descrito.
Após cada arquivo editado, confirme o que foi feito antes de seguir para o próximo.
Lembre-se: os arquivos untracked (*.bat, manager.ps1, docs/, _contexto-ia/) NÃO podem ser apagados. Se qualquer um sumir, pare imediatamente e recupere via Seção 9 do GUIA.
    )
    ClipWait, 1
    if (ErrorLevel) {
        Clipboard := ClipboardBackup
        ClipboardBackup := ""
        return
    }
    SendInput, ^v
    Sleep, 100
    Clipboard := ClipboardBackup
    ClipboardBackup := ""
return

; ============================================================
; FRASE DE EMERGÊNCIA LOCAL (rollback)
; Atalho: \emg merge
; ============================================================

:*:\emg merge::
    ClipboardBackup := ClipboardAll
    Clipboard =
    ( LTrim
🚨 ROLLBACK DE EMERGÊNCIA

O merge causou o seguinte problema: [DESCREVA O PROBLEMA]

Consulte a Seção 8 do GUIA-MERGE-DODO.md e execute o rollback do branch dodo/main para o commit anterior ao merge.

IMPORTANTE: Após o git reset, verifique IMEDIATAMENTE se os arquivos untracked ainda estão presentes (manager.ps1, *.bat, docs/, _contexto-ia/). Se algum sumir, use a Seção 9 do GUIA para recuperar via histórico do git ou backup.
    )
    ClipWait, 1
    if (ErrorLevel) {
        Clipboard := ClipboardBackup
        ClipboardBackup := ""
        return
    }
    SendInput, ^v
    Sleep, 100
    Clipboard := ClipboardBackup
    ClipboardBackup := ""
return


; ############################################################
; SEÇÃO 2: AMBIENTE VPS (LINUX / DOCKER)
; ############################################################

; ============================================================
; INÍCIO DE ATUALIZAÇÃO DA VPS
; Atalho: \att vps
; ============================================================

:*:\att vps::
    ClipboardBackup := ClipboardAll
    Clipboard =
    ( LTrim
🚀 ATUALIZAÇÃO SEGURA DO QWENBRIDGE NA VPS LINUX 🚀

Precisamos atualizar a instalação do `qwenbridge` nesta VPS Linux para que ela fique sincronizada com a versão mais recente da branch `dodo/main` do nosso repositório no GitHub:
`https://github.com/dougllassillva27/qwenbridge-dodo.git`

⚠️ REGRAS CRÍTICAS DE SEGURANÇA E PRESERVAÇÃO DE DADOS:
1. **DADOS NÃO-TRACKEADOS SÃO SAGRADOS:**
   - O arquivo `.env` (chaves, portas, credenciais) NÃO pode ser deletado, zerado ou sobrescrito.
   - O diretório `data/` (banco SQLite `qwenproxy.db`, sessões, contas, cookies e tokens de autenticação) NUNCA pode ser apagado ou corrompido.
   - Se houver diretórios de perfis (`qwen_profiles/`), logs ou scripts locais, preserve-os intactos.
2. **NUNCA EXECUTE COMANDOS DESTRUTIVOS:**
   - Proibido usar `git clean -fdx` ou `git reset --hard` sem confirmação e backup prévio.
   - Proibido usar `docker compose down -v` (a flag `-v` remove volumes de dados).
3. **BACKUP PRÉ-ATUALIZAÇÃO É OBRIGATÓRIO:**
   - Antes de qualquer `git pull` ou rebuild, crie um backup compactado de segurança dos dados:
     `tar -czvf backup-pre-update-$(date +%Y%m%d_%H%M%S).tar.gz .env data/`

📋 PROTOCOLO DE ANÁLISE PRÉVIA (NÃO REINICIE O SERVIÇO AINDA):
1. Verifique o status atual do diretório:
   `git status` e `git branch -v`
2. Busque as alterações remotas sem aplicar:
   `git fetch origin dodo/main`
3. Analise o que vai mudar:
   `git log HEAD..origin/dodo/main --oneline`
   `git diff --stat HEAD origin/dodo/main`
4. Inspecione se o `.env.example` novo introduziu alguma variável de ambiente obrigatória que ainda não existe no `.env` da VPS.
5. Verifique o método de execução atual (ex: `docker compose ps` ou `systemctl status` / `pm2 list`).
6. Apresente um **Relatório Resumido** com:
   - Commits que serão integrados
   - Se há novas variáveis no `.env` para preencher
   - Plano passo a passo da atualização (backup -> pull -> rebuild/restart -> validação de saúde)

Aguarde minha aprovação antes de aplicar as mudanças e reiniciar o proxy.
    )
    ClipWait, 1
    if (ErrorLevel) {
        Clipboard := ClipboardBackup
        ClipboardBackup := ""
        return
    }
    SendInput, ^v
    Sleep, 100
    Clipboard := ClipboardBackup
    ClipboardBackup := ""
return

; ============================================================
; FRASE DE APROVAÇÃO RÁPIDA NA VPS
; Atalho: \ok vps
; ============================================================

:*:\ok vps::
    ClipboardBackup := ClipboardAll
    Clipboard =
    ( LTrim
✅ Relatório e plano de atualização da VPS aprovados! Pode executar a atualização.

Passos esperados durante a execução:
1. Executar o backup prévio (`tar -czvf backup-pre-update-$(date +%Y%m%d_%H%M%S).tar.gz .env data/`).
2. Atualizar código via `git pull origin dodo/main`.
3. Se rodar em Docker:
   `docker compose build --pull && docker compose up -d`
   (ou se rodar nativo: `npm install --omit=dev && npm run build:admin` e reiniciar serviço).
4. Validar integridade e conectividade:
   - Checar se container/serviço está online: `docker compose ps`
   - Testar endpoint de saúde: `curl -I http://127.0.0.1:50002/health`
   - Verificar logs recentes: `docker compose logs --tail=40 qwenbridge`
   - Confirmar que a pasta `data/` e arquivo `.env` continuam íntegros.

Me informe o status final dos testes após concluir.
    )
    ClipWait, 1
    if (ErrorLevel) {
        Clipboard := ClipboardBackup
        ClipboardBackup := ""
        return
    }
    SendInput, ^v
    Sleep, 100
    Clipboard := ClipboardBackup
    ClipboardBackup := ""
return

; ============================================================
; FRASE DE EMERGÊNCIA NA VPS (rollback)
; Atalho: \emg vps
; ============================================================

:*:\emg vps::
    ClipboardBackup := ClipboardAll
    Clipboard =
    ( LTrim
🚨 ROLLBACK DE EMERGÊNCIA NA VPS 🚨

A atualização apresentou problemas. Execute o rollback imediatamente:

1. Pare o serviço com erro:
   `docker compose stop` (ou `systemctl stop qwenbridge` / `pm2 stop qwenbridge`)
2. Volte o repositório para o commit anterior ao update:
   `git log --oneline -5`  (identifique o hash anterior)
   `git checkout <HASH_ANTERIOR>`
3. Se os dados em `data/` ou `.env` foram corrompidos, restaure o arquivo de backup gerado antes do update:
   `tar -xzvf backup-pre-update-*.tar.gz`
4. Reconstrua e suba a versão anterior:
   `docker compose up -d --build` (ou reinicie o serviço nativo)
5. Verifique a saúde e os logs:
   `docker compose ps`
   `curl -I http://127.0.0.1:50002/health`
   `docker compose logs --tail=50 qwenbridge`

Reporte o resultado do rollback e os erros que ocorreram.
    )
    ClipWait, 1
    if (ErrorLevel) {
        Clipboard := ClipboardBackup
        ClipboardBackup := ""
        return
    }
    SendInput, ^v
    Sleep, 100
    Clipboard := ClipboardBackup
    ClipboardBackup := ""
return
