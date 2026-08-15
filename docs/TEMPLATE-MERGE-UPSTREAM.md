# 📨 Template de Mensagem — Merge de Atualização Upstream

> **Como usar:** Copie o bloco abaixo, preencha os campos marcados com `[COLCHETES]` e envie para a IA.
> 
> Consulte `docs/GUIA-MERGE-DODO.md` se tiver dúvidas sobre o processo completo.

---

## 📋 Mensagem Padrão (copiar daqui)

```
🔀 INÍCIO DE MERGE DODO — PROTOCOLO GIT STRATEGY 🔀

Temos uma nova atualização (Upstream) do repositório oficial do `qwenproxy`.
Eu **já baixei** os arquivos localmente em `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy`.
Não tente usar git clone ou acessar a internet.

📂 **Diretórios Mapeados:**
- **Nova Versão (Upstream — Referência):** `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\qwenproxy-att\qwenproxy`
- **Nossa Produção (Destino / branch dodo/main):** `D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge`

📄 **Documentos de Referência Obrigatória (leia antes de qualquer ação):**
- Manifesto de blindagens: `alterações-dodo.md` (raiz da produção)
- Manual de merge + checklist 14 pontos: `docs/GUIA-MERGE-DODO.md`

🗒️ **Contexto desta Atualização:**
- Versão upstream anterior: [EX: v1.12.9]
- Versão upstream nova: [EX: v1.13.0]
- Mudanças conhecidas neste update (se souber): [DESCREVA OU ESCREVA "Desconhecido"]

📜 **Regras Absolutas — Fase de Análise (NÃO EDITE NADA AINDA):**
1. Leia OBRIGATORIAMENTE o `alterações-dodo.md` e o `GUIA-MERGE-DODO.md` antes de qualquer ação.
2. As blindagens Dodo são sagradas. O upstream se adapta a elas, nunca o contrário.
3. Sua primeira tarefa é **puramente de análise e comparação** entre os dois diretórios.
4. Crie um **Relatório de Análise de Diferenças** em Markdown contendo:
   a) O que mudou no upstream (arquivos, funções, comportamentos novos/removidos)
   b) Quais dos 14 pontos do checklist (Seção 6 do GUIA) estão em risco de colisão
   c) Seu plano exato, passo a passo, para executar o merge preservando as blindagens

Aguardo o relatório. Somente após minha aprovação você terá permissão para editar qualquer arquivo de produção.
```

---

## 🔎 Guia de Preenchimento

| Campo | O que colocar |
|-------|--------------|
| `[EX: v1.12.9]` | Versão do upstream que tínhamos antes |
| `[EX: v1.13.0]` | Versão nova que chegou agora |
| `[DESCREVA ou Desconhecido]` | Se o dono do projeto postou changelog, cole aqui. Se não, escreva "Desconhecido" |

---

## ✅ Frase de Aprovação do Relatório

Após analisar o relatório da IA, diga apenas:

```
✅ Relatório aprovado. Pode iniciar o merge seguindo o plano exato descrito.
Após cada arquivo editado, confirme o que foi feito antes de seguir para o próximo.
```

---

## ⚠️ Frase de Emergência (Algo Quebrou Pós-Merge)

```
🚨 ROLLBACK DE EMERGÊNCIA

O merge causou o seguinte problema: [DESCREVA O PROBLEMA]

Consulte a Seção 7 do GUIA-MERGE-DODO.md e execute o rollback do branch
dodo/main para o commit anterior ao merge.
```
