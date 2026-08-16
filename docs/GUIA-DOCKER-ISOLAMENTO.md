# 🐳 Guia de Implantação e Isolamento em Docker (Teto de 4GB de RAM)

> **Objetivo:** Rodar o proxy **QwenBridge** em um ambiente 100% isolado dentro do seu Windows, garantindo estabilidade, segurança e limitando o uso máximo de memória a **4 GB de RAM**, sem pesar ou travar o restante do seu computador.
> **Porta Padrão Obrigatória:** `50002`
> **Painel Visual Web Integrado:** `http://localhost:50002/`

---

## 📌 1. Por que rodar no Docker em vez de uma VM tradicional?

Para quem não é da área de infraestrutura, uma **Máquina Virtual (VM)** tradicional (como VMware ou VirtualBox) funciona como se você instalasse um segundo computador inteiro dentro do seu PC (com Windows ou Linux completo). Isso consome muita memória só para manter a interface e os serviços da VM abertos.

Já o **Docker** funciona como uma "cápsula" super leve:
- **Zero desperdício:** Não carrega um sistema operacional pesado em segundo plano.
- **Memória sob demanda:** Se você definir o teto em 4 GB, mas o proxy estiver usando apenas 600 MB, ele **só consome 600 MB da sua máquina física**.
- **Isolamento total:** Se o navegador interno do proxy travar ou acumular memória, ele é contido dentro do Docker e reiniciado sem afetar o seu Windows.
- **Porta direta:** Você continua acessando normalmente no seu Windows pelo endereço `http://localhost:50002`.

---

## 📋 2. Pré-requisitos (O que você precisa ter instalado)

1. **Docker Desktop no Windows:**
   - Se ainda não tiver instalado, baixe gratuitamente no site oficial: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
   - Durante a instalação, mantenha marcada a opção **"Use WSL 2 instead of Hyper-V"** (recomendado pela própria Microsoft).
2. **Abra o Docker Desktop:**
   - Verifique se o ícone da baleia no canto inferior direito do Windows (perto do relógio) está verde e ativo ("Engine running").

---

## ⚙️ 3. Configuração dos Arquivos

O seu projeto já vem pré-configurado para Docker! Só precisamos garantir duas configurações simples:

### Passo 3.1 — Configurar o Arquivo `.env`
Na pasta raiz do projeto (`qwenbridge`), certifique-se de que o arquivo `.env` existe com suas contas e a porta `50002`:

```env
# Suas contas Qwen (email:senha separados por ponto e vírgula)
QWEN_ACCOUNTS=seu_email@dominio.com:sua_senha_aqui

# Chave de segurança para usar nos seus aplicativos (Cline, Roo Code, etc.)
# API_KEY=sua-chave-secreta-aqui

# Porta de comunicação (Padrão Dodo: 50002)
PORT=50002
HOST=0.0.0.0

# Otimizações de Memória do Dodo Ecosystem
PLAYWRIGHT_PREPARE_ALL_ON_STARTUP=false
PLAYWRIGHT_MAX_ACTIVE_CONTEXTS=1
```

> ⚠️ **Importante:** Dentro do Docker, a variável `HOST` deve ser `0.0.0.0` para que o Windows consiga se comunicar com o container na porta `50002`.

---

### Passo 3.2 — Limite de 4GB no `docker-compose.yml`
O arquivo `docker-compose.yml` na raiz do projeto orquestra a cápsula com a porta `50002`, teto de 4GB de RAM e 2 núcleos de CPU:

```yaml
services:
  qwenbridge:
    build: .
    container_name: qwenbridge
    shm_size: '1gb'
    ports:
      - "${PORT:-50002}:${PORT:-50002}"
    env_file:
      - .env
    volumes:
      # Mantém os logins e histórico salvos mesmo se o Docker reiniciar
      - ./data:/app/data
    deploy:
      resources:
        limits:
          memory: 4096M   # Teto máximo de 4GB de RAM
          cpus: '2.0'     # Limite de até 2 núcleos de processador
        reservations:
          memory: 512M    # Memória inicial garantida
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 🚀 4. Passo a Passo de Execução (Como Usar)

Abra o seu terminal (PowerShell ou Prompt de Comando) dentro da pasta do `qwenbridge`:

### 🔹 Passo 1: Construir e Iniciar o Proxy em Segundo Plano
```powershell
docker compose up -d --build
```
> **O que esse comando faz?**
> - Baixa a imagem do Playwright/Ubuntu e instala todas as dependências automaticamente na cápsula.
> - O parâmetro `-d` (*detached*) libera o seu terminal imediatamente enquanto o proxy roda em segundo plano.

---

### 🔹 Passo 2: Acessar o Dashboard Web no Navegador (Recomendado)
Abra qualquer navegador (Chrome, Edge, Firefox) e acesse:
👉 **[http://localhost:50002/](http://localhost:50002/)**

Na página web você pode:
- 📊 **Monitorar a RAM:** Veja em tempo real quanto dos 4GB está sendo usado.
- 👥 **Gerenciar Contas:** Veja quais contas estão ativas ou em cooldown (com contagem regressiva) e clique em **"🔓 Destravar"** para liberar qualquer conta na hora.
- 📜 **Acompanhar Logs ao Vivo:** Veja todas as requisições e respostas passando pelo proxy em tempo real, sem precisar de terminal.
- 🧪 **Testar o Chat:** Envie um prompt de teste para validar se o modelo está respondendo rápido.

---

### 🔹 Passo 3: Acompanhar Logs pelo Terminal (Alternativa via CMD)
Se preferir olhar os logs direto pelo terminal:
```powershell
docker compose logs -f
```
*(Para sair da visualização dos logs no terminal a qualquer momento, aperte `Ctrl + C`. O proxy continuará rodando normalmente).*

---

### 🔹 Passo 4: Como verificar o consumo de RAM pelo Terminal
```powershell
docker stats qwenbridge
```
Exemplo de retorno:
```text
CONTAINER ID   NAME         CPU %     MEM USAGE / LIMIT     MEM %
a1b2c3d4e5f6   qwenbridge   0.45%     480MiB / 4GiB         11.72%
```

---

## 🎛️ 5. Três Formas Fáceis de Controlar o Proxy

Você tem total liberdade para escolher como prefere gerenciar o seu proxy:

| Forma de Controle | Para que serve | Onde fazer |
| :--- | :--- | :--- |
| 🌐 **1. Dashboard Web** | Ver logs ao vivo, destravar contas em cooldown, limpar cache e testar prompts | Acesse `http://localhost:50002/` no navegador |
| 🐳 **2. Docker Desktop (GUI)** | Ligar, pausar, reiniciar ou desligar o container com 1 clique | Botões ▶️ Play / ⏹️ Stop na janela do Docker Desktop |
| 💻 **3. Terminal (CLI)** | Automatizar scripts e comandos rápidos | Comandos `docker compose up -d` / `down` no PowerShell |

---

## 🛑 6. Comandos Úteis do Dia a Dia

| O que você quer fazer? | Comando no PowerShell |
| :--- | :--- |
| **Iniciar o proxy em segundo plano** | `docker compose up -d` |
| **Pausar / Desligar o proxy** | `docker compose down` |
| **Reiniciar o proxy** | `docker compose restart` |
| **Ver logs em tempo real no terminal** | `docker compose logs -f` |
| **Verificar consumo de RAM e CPU** | `docker stats qwenbridge` |
| **Atualizar código e reconstruir** | `docker compose up -d --build` |

---

## 🔌 7. Como Conectar suas Ferramentas (Cline, Roo Code, Cursor, LibreChat)

Dentro de qualquer ferramenta de IA que você usa no Windows, aponte para a porta **50002**:

- **Base URL:** `http://localhost:50002/v1`
- **Formato Suportado:** OpenAI Compatible ou Anthropic Messages (`/v1/messages`)
- **API Key:** A mesma que você definiu no seu `.env` (`API_KEY`) ou qualquer texto se desativada.
- **Modelos disponíveis:**
  - `qwen3.8-max-thinking` *(Recomendado - Suporte nativo a raciocínio)*
  - `qwen3.8-max`
  - `qwen3.8-max-thinking[1M]` *(Janela longa de 1 milhão de tokens)*
  - `qwen-plus`, `qwen-turbo`, etc.

---

## 🛡️ 8. O que acontece com os meus Logins e Contas?

Tudo o que o Playwright salvar (sessões ativas, cookies e banco SQLite) é gravado automaticamente na pasta `./data` dentro do seu projeto no Windows.

Isso significa que:
- Você **nunca perde o login** se desligar o Docker ou reiniciar o computador.
- Seus dados persistem mesmo após recriar a imagem com `docker compose up -d --build`.
- Se precisar fazer backup ou limpar sessões, basta gerenciar a pasta `./data` no próprio Windows Explorer.

---

## ❓ 9. Perguntas Frequentes & Solução de Problemas

#### P: O Docker diz que a porta 50002 já está em uso (`port is already allocated`).
**R:** Significa que você já tem outra instância do QwenBridge rodando fora do Docker (via `npm start` ou Proxy Launcher). Feche o processo anterior e rode `docker compose up -d` novamente.

#### P: Mudei uma senha ou adicionei uma nova conta no `.env`, como aplico?
**R:** Basta rodar:
```powershell
docker compose restart
```
*(Ou clicar no botão restart na interface do Docker Desktop).*

#### P: Atualizei os arquivos do projeto pelo Git, como atualizo o Docker?
**R:** Basta rodar:
```powershell
docker compose up -d --build
```
O Docker recompilará o container preservando 100% dos seus logins na pasta `./data`.

#### P: Quero voltar a rodar no modo tradicional (sem Docker). O que faço?
**R:** Basta rodar `docker compose down` para desligar o container e iniciar localmente com `npm start`. Seus dados na pasta `./data` são 100% compatíveis entre ambos os modos.
