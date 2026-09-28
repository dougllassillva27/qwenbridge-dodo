# ­ƒÉº Manual Pr├ítico de Comandos Linux & Docker para VPS

> **Objetivo:** Guia de refer├¬ncia r├ípida com os comandos mais utilizados no dia a dia para administrar sua VPS Linux (Ubuntu), gerenciar arquivos, editar c├│digos e controlar os containers Docker do ecossistema.

---

## ­ƒº¡ 1. Navega├º├úo e Localiza├º├úo

| O que voc├¬ quer fazer? | Comando | Explica├º├úo |
|---|---|---|
| **Ver onde voc├¬ est├í agora** | `pwd` | Mostra o caminho completo da pasta atual (ex: `/root/dodo`). |
| **Listar arquivos e pastas** | `ls` | Mostra os arquivos e pastas simples. |
| **Listar com detalhes e ocultos** | `ls -la` | Mostra permiss├Áes, tamanho e arquivos ocultos (como `.env`). |
| **Listar com tamanho leg├¡vel** | `ls -lh` | Mostra os tamanhos em **KB, MB e GB**. |
| **Entrar em uma pasta** | `cd nome_da_pasta` | Entra no diret├│rio especificado. |
| **Voltar para a pasta anterior** | `cd ..` | Sobe um n├¡vel de pasta. |
| **Ir direto para a pasta inicial (Home)** | `cd ~` | Vai direto para a pasta `/root` ou `/home/usuario`. |
| **Voltar para a ├║ltima pasta visitada** | `cd -` | Retorna exatamente para onde voc├¬ estava antes. |

---

## ­ƒôü 2. Criar, Deletar, Mover e Renomear Arquivos

| O que voc├¬ quer fazer? | Comando | Explica├º├úo |
|---|---|---|
| **Criar uma nova pasta** | `mkdir minha_pasta` | Cria a pasta no diret├│rio atual. |
| **Criar pastas aninhadas** | `mkdir -p pasta/subpasta/outra` | Cria a estrutura inteira de uma s├│ vez. |
| **Criar um arquivo vazio** | `touch arquivo.txt` | Cria um arquivo em branco. |
| **Copiar um arquivo** | `cp arquivo.txt copia.txt` | Cria uma c├│pia do arquivo. |
| **Copiar uma pasta inteira** | `cp -r pasta_origem pasta_destino` | Copia a pasta com todo o conte├║do interno. |
| **Mover ou Renomear** | `mv antigo.txt novo.txt` | Renomeia o arquivo ou move para outra pasta. |
| **Mover pasta inteira** | `mv ~/captchaResolve ~/dodo/` | Move a pasta `captchaResolve` para dentro de `~/dodo/`. |
| **Apagar um arquivo** | `rm arquivo.txt` | Deleta o arquivo permanentemente. |
| **Apagar uma pasta e seu conte├║do** | `rm -rf nome_da_pasta` | ÔÜá´©Å **Cuidado:** Deleta a pasta e tudo dentro dela sem confirma├º├úo. |

---

## ­ƒæü´©Å 3. Visualizar Conte├║do de Arquivos sem Abrir

| O que voc├¬ quer fazer? | Comando | Explica├º├úo |
|---|---|---|
| **Ver o arquivo inteiro no terminal** | `cat .env` | Imprime todo o conte├║do na tela. |
| **Ver as primeiras 20 linhas** | `head -n 20 arquivo.log` | Mostra o in├¡cio do arquivo. |
| **Ver as ├║ltimas 30 linhas** | `tail -n 30 arquivo.log` | Mostra o final do arquivo. |
| **Acompanhar arquivo ao vivo (log)** | `tail -f arquivo.log` | Mostra novas linhas conforme forem gravadas (`Ctrl + C` para sair). |

---

## Ô£Å´©Å 4. Editor de Texto Nano (Como Editar no Terminal)

Para abrir ou criar qualquer arquivo: `nano nome_do_arquivo` (ex: `nano .env`).

### Ôî¿´©Å Principais Atalhos do Nano:
- ­ƒÆ¥ **Salvar altera├º├Áes:** Pressione **`Ctrl + O`**, depois aperte **`Enter`**.
- ­ƒÜ¬ **Sair do editor:** Pressione **`Ctrl + X`**.
- ­ƒôï **Colar texto:** Clique com o **bot├úo direito do mouse** no terminal (ou `Shift + Insert`).
- ­ƒöÄ **Pesquisar palavra:** Pressione **`Ctrl + W`**, digite o texto e aperte `Enter`.
- Ôå®´©Å **Desfazer digita├º├úo:** Pressione **`Alt + U`**.
- ­ƒöó **Ir para uma linha espec├¡fica:** Pressione **`Ctrl + _`**, digite o n├║mero da linha e aperte `Enter`.
- ­ƒùæ´©Å **Recortar linha inteira:** Pressione **`Ctrl + K`**.

---

## ­ƒÉ│ 5. Gerenciamento do Docker & Docker Compose

Execute estes comandos dentro da pasta do projeto (ex: `cd ~/dodo`):

| O que voc├¬ quer fazer? | Comando | Explica├º├úo |
|---|---|---|
| **Iniciar tudo em segundo plano** | `docker compose up -d` | Sobe todos os containers sem travar seu terminal. |
| **Reconstruir e iniciar** | `docker compose up -d --build` | Aplica mudan├ºas no c├│digo/Dockerfile e reinicia. |
| **Reiniciar os containers** | `docker compose restart` | Rein├¡cio r├ípido (├│timo ap├│s mudar o `.env`). |
| **Parar e desligar os containers** | `docker compose down` | Para todos os containers da pasta. |
| **Ver logs ao vivo** | `docker compose logs -f` | Acompanha as mensagens em tempo real (`Ctrl + C` para sair). |
| **Ver logs de 1 servi├ºo espec├¡fico** | `docker compose logs -f qwenbridge` | Filtra logs apenas do proxy principal. |
| **Ver uso de Mem├│ria e CPU** | `docker stats` | Mostra consumo de RAM/CPU de cada container ao vivo. |
| **Ver containers ativos** | `docker ps` | Lista os containers rodando, portas e tempo online. |
| **Ver todos os containers (inclusive parados)** | `docker ps -a` | Mostra hist├│rico de containers. |
| **Limpar imagens antigas n├úo usadas** | `docker image prune -f` | Libera espa├ºo em disco na VPS. |

---

## ­ƒôè 6. Monitoramento e Sa├║de da VPS

| O que voc├¬ quer fazer? | Comando | Explica├º├úo |
|---|---|---|
| **Ver consumo de Mem├│ria RAM e SWAP** | `free -h` | Mostra total, usado e livre em GB/MB. |
| **Ver espa├ºo livre no Disco (HD/SSD)** | `df -h` | Mostra porcentagem de uso do disco r├¡gido. |
| **Gerenciador de tarefas visual** | `htop` | Monitor visual de CPU, RAM e processos (`F10` ou `q` para sair). |
| **Tempo ligado e carga do sistema** | `uptime` | Mostra h├í quanto tempo a VPS est├í online. |
| **Ver portas abertas e ouvindo** | `ss -tulpn` | Mostra quais servi├ºos est├úo escutando nas portas (80, 50002, etc.). |
| **Ver seu IP p├║blico real** | `curl -s ifconfig.me` | Retorna o IP p├║blico da VPS. |

---

## ÔÜÖ´©Å 7. Gerenciamento de Servi├ºos do Sistema (Systemd)

Para servi├ºos como Nginx, SSH ou bots em segundo plano:

| O que voc├¬ quer fazer? | Comando |
|---|---|
| **Ver status de um servi├ºo** | `sudo systemctl status nginx` |
| **Reiniciar um servi├ºo** | `sudo systemctl restart nginx` |
| **Parar um servi├ºo** | `sudo systemctl stop nginx` |
| **Iniciar um servi├ºo** | `sudo systemctl start nginx` |
| **Recarregar configura├º├Áes sem parar** | `sudo systemctl reload nginx` |
| **Ver logs de um servi├ºo** | `sudo journalctl -u nginx -f` |

---

## ­ƒøí´©Å 8. Firewall (UFW) & Seguran├ºa

| O que voc├¬ quer fazer? | Comando | Explica├º├úo |
|---|---|---|
| **Ver status e regras ativas** | `sudo ufw status verbose` | Lista todas as portas liberadas ou bloqueadas. |
| **Liberar uma porta** | `sudo ufw allow 80/tcp` | Permite conex├Áes na porta 80. |
| **Remover libera├º├úo de porta** | `sudo ufw delete allow 50002/tcp` | Bloqueia o acesso externo direto ├á porta. |
| **Recarregar regras** | `sudo ufw reload` | Aplica as novas regras imediatamente. |

---

## ÔÜí 9. Truques e Atalhos de Produtividade no Terminal

- **Autocompletar:** Comece a digitar o nome de uma pasta ou arquivo e aperte **`Tab`** (completa sozinho).
- **Repetir comandos anteriores:** Use a tecla **`Seta para Cima Ôåæ`** para navegar pelo hist├│rico.
- **Buscar comandos no hist├│rico:** Pressione **`Ctrl + R`**, digite parte do comando e aperte `Enter`.
- **Cancelar qualquer comando travado:** Pressione **`Ctrl + C`**.
- **Limpar a tela:** Digite `clear` ou aperte **`Ctrl + L`**.
- **Copiar e Colar no Terminal:**
  - Copiar: Selecione o texto com o mouse.
  - Colar: Clique com o **bot├úo direito do mouse** ou use **`Shift + Insert`**.
