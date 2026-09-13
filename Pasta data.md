# Documentação de Armazenamento: Pasta `data/`

## 📌 Visão Geral

A pasta `data/` é o núcleo de persistência do **QwenBridge**, armazenando:
- **`data/db/`**: Banco de dados SQLite (`qwenproxy.db`) criptografado contendo contas, senhas e histórico.
- **`data/qwen_profiles/`**: Perfis isolados de navegação Chromium (Playwright) com cookies de autenticação de cada conta, `localStorage`, `IndexedDB` e impressões digitais de anti-bot.
- **`data/account-priority.json`**: Ordem e pesos de rotação das contas.

---

## ⚠️ O Problema com o OneDrive

O repositório principal deste projeto reside dentro da pasta sincronizada pelo OneDrive:
`D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge`

### Impactos observados da sincronização:
1. **Conflito e Corrupção de Sessões:** O Chromium e o SQLite abrem e modificam centenas de arquivos simultaneamente (`Cookies`, `Cookies-journal`, `Local State`, `Preferences`). O OneDrive tenta fazer upload desses arquivos enquanto ainda estão abertos em memória, gerando arquivos duplicados de conflito (ex: `Local State-DESKTOP-RHSRACV`, `Cookies-DESKTOP-RHSRACV`).
2. **Perda de Cookies (0 cookies no boot):** Ao se deparar com bancos travados ou cópias de conflito, o Chromium falha em carregar a sessão e gera perfis vazios, forçando o proxy a realizar login do zero a cada inicialização (gerando demoras de ~2 minutos e bloqueios por captcha).

---

## 🛠️ Solução Implementada: Junção NTFS (`mklink /J`)

O Windows NTFS possui um recurso nativo de **Directory Junction (Junção de Diretório)**. O cliente do **OneDrive ignora por padrão a recursão em Junções NTFS**, não fazendo upload e nem bloqueando arquivos que estejam dentro delas.

### Topologia de Armazenamento:

```
[Local Físico Real (Fora do OneDrive)]:
D:\ArquivosProjetos\QwenBridge\data\
   ├── db/ (qwenproxy.db)
   ├── qwen_profiles/ (perfis Chromium das 20 contas)
   ├── account-priority.json
   └── sync-state.json

               ▲
               │  (Junção NTFS transparente)
               │
[No Repositório Git / QwenBridge]:
D:\Onedrive - Douglas\...\proxys\qwenbridge\data <<===>> D:\ArquivosProjetos\QwenBridge\data
```

### Vantagens:
- **100% Transparente:** O Node.js, Playwright e scripts executáveis continuam usando caminhos relativos `./data/...` normalmente, sem necessidade de alterar código ou variáveis de ambiente.
- **Zero Interferência do OneDrive:** Nenhum lock de I/O, zero criação de arquivos `-DESKTOP-RHSRACV` e sessões preservadas indefinidamente.
- **Git Limpo:** A pasta `data/` permanece devidamente ignorada pelo `.gitignore`, mantendo o repositório leve e seguro.

---

## 📋 Histórico da Migração (11/09/2026)

1. **Cópia Íntegra:** 7.185 arquivos e 2.244 diretórios copiados com integridade 100% via `robocopy` para `D:\ArquivosProjetos\QwenBridge\data`.
2. **Criação do Link:** Criada a junção via comando:
   ```cmd
   mklink /J "D:\Onedrive - Douglas\OneDrive\Pessoal\Dodo\Programacao\Git\proxyIA\proxy-launcher\proxys\qwenbridge\data" "D:\ArquivosProjetos\QwenBridge\data"
   ```
3. **Higienização:** Expurgados todos os arquivos legados de conflito `-DESKTOP-RHSRACV`.
4. **Limpeza do OneDrive:** A pasta antiga `data` dentro do OneDrive foi excluída, liberando ~608 MB da nuvem.
5. **Validação:** Todas as 20 contas carregadas com sucesso via Node.js através da junção.

---

## 🔧 Manutenção e Restauração em Nova Máquina

Se você clonar este repositório em outro computador ou reinstalar o sistema operacional:
1. Certifique-se de que a pasta física de dados exista (ex: `D:\ArquivosProjetos\QwenBridge\data`).
2. No diretório raiz do `qwenbridge`, execute no prompt de comando (`cmd.exe`):
   ```cmd
   mklink /J data "D:\ArquivosProjetos\QwenBridge\data"
   ```
3. O proxy iniciará imediatamente com todas as contas e cookies preservados.
