# Template de Mensagem -- Merge de Atualizacao Upstream

> **Como usar:** Copie o bloco abaixo, preencha os campos marcados com `[COLCHETES]` e envie para a IA.
>
> Consulte `docs/GUIA-MERGE-DODO.md` se tiver duvidas sobre o processo completo.
>
> **ANTES DE ENVIAR:** Execute obrigatoriamente o backup da Secao 4 do GUIA-MERGE-DODO.md.

---

## Mensagem Padrao (copiar daqui)

```
INICIO DE MERGE DODO -- PROTOCOLO GIT STRATEGY

Temos uma nova atualizacao (Upstream) do repositorio oficial do `qwenbridge`.
Eu **ja baixei** os arquivos localmente em `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy_john`.
Nao tente usar git clone ou acessar a internet.

Diretorios Mapeados:
- Nova Versao (Upstream -- Referencia): `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy_john`
- Nossa Producao (Destino / branch dodo/main): `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge`

Documentos de Referencia Obrigatoria (leia antes de qualquer acao):
- Manifesto e historico de blindagens: `resumo-de-trabalho.md` (raiz da producao)
- Contexto e diretrizes Dodo: `_contexto-ia/Geral.md` e `_contexto-ia/Commit.md`
- Manual de merge + checklist (incluindo Painel Web e .bat): `docs/GUIA-MERGE-DODO.md`

Contexto desta Atualizacao:
- Versao upstream anterior: [EX: v1.3.5 ou commit hash]
- Versao upstream nova: [EX: v1.4.0 ou commit hash]
- Mudancas conhecidas neste update (se souber): [DESCREVA OU ESCREVA "Desconhecido"]

CONFIRMACAO PRE-MERGE (preencha voce mesmo antes de enviar):
- [ ] Backup dos arquivos locais feito em: `_backup-pre-merge-[DATA-HORA]`
- [ ] Verificacao de integridade executada (Secao 4.2 do GUIA): todos os arquivos criticos presentes

Regras Absolutas -- Fase de Analise (NAO EDITE NADA AINDA):
1. Leia OBRIGATORIAMENTE o `resumo-de-trabalho.md`, `_contexto-ia/Geral.md`, `_contexto-ia/Commit.md`
   e o `docs/GUIA-MERGE-DODO.md` (especialmente a Secao 4) antes de qualquer acao.
2. As blindagens Dodo e a documentacao local sao sagradas. O upstream se adapta a elas, nunca o contrario.
3. Os arquivos untracked (*.bat, manager.ps1, docs/, _contexto-ia/, graphify-out/) sao INVISIVEIS ao git
   e podem ser apagados sem aviso. Nunca execute git clean, git checkout -- . ou operacoes destrutivas.
4. Sua primeira tarefa e **puramente de analise e comparacao** entre os dois diretorios.
5. Crie um **Relatorio de Analise de Diferencas** em Markdown contendo:
   a) O que mudou no upstream (arquivos, funcoes, comportamentos novos/removidos)
   b) Quais dos 17 pontos do checklist (Secao 7 do GUIA) estao em risco de colisao
   c) Seu plano exato, passo a passo, para executar o merge preservando as blindagens
      e a integridade de todos os arquivos locais (incluindo os untracked)

Aguardo o relatorio. Somente apos minha aprovacao voce tera permissao para editar qualquer arquivo de producao.
```

---

## Guia de Preenchimento

| Campo | O que colocar |
|-------|--------------|
| `[EX: v1.3.5]` | Versao do upstream que tinhamos antes |
| `[EX: v1.4.0]` | Versao nova que chegou agora |
| `[DESCREVA ou Desconhecido]` | Se o dono do projeto postou changelog, cole aqui. Se nao, escreva "Desconhecido" |
| `[DATA-HORA]` | Formato `yyyy-MM-dd_HH-mm` (ex: `2026-09-25_08-30`) |

---

## Frase de Aprovacao do Relatorio

Apos analisar o relatorio da IA, diga apenas:

```
Relatorio aprovado. Pode iniciar o merge seguindo o plano exato descrito.
Apos cada arquivo editado, confirme o que foi feito antes de seguir para o proximo.
Lembre-se: os arquivos untracked (*.bat, manager.ps1, docs/, _contexto-ia/) NAO podem
ser apagados. Se qualquer um sumir, pare imediatamente e recupere via Secao 9 do GUIA.
```

---

## Frase de Emergencia (Algo Quebrou Pos-Merge)

```
ROLLBACK DE EMERGENCIA

O merge causou o seguinte problema: [DESCREVA O PROBLEMA]

Consulte a Secao 8 do GUIA-MERGE-DODO.md e execute o rollback do branch
dodo/main para o commit anterior ao merge.

IMPORTANTE: Apos o git reset, verifique IMEDIATAMENTE se os arquivos untracked
ainda estao presentes (manager.ps1, *.bat, docs/, _contexto-ia/). Se algum
sumir, use a Secao 9 do GUIA para recuperar via historico do git ou backup.
```

---

## Lembretes Criticos (nao enviar para a IA, apenas para voce)

- **ANTES do merge:** Executar backup (Secao 4.1 do GUIA) e verificacao de integridade (4.2)
- **DURANTE o merge:** Nunca aprovar commits que deletem `*.bat`, `manager.ps1`, `docs/`, `_contexto-ia/` ou `graphify-out/`
- **APOS o merge:** Executar o Checklist completo da Secao 7, comecando pelo item 0 (arquivos untracked)
- **Se algo sumir:** Secao 9 do GUIA tem os comandos exatos de recuperacao, incluindo o commit `32e5899` como referencia
