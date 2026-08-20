import { useState, useMemo } from 'react'
import {
  Globe, Search, Copy, Check, ExternalLink, Code2, Sparkles,
  Server, Shield, Activity, Film, Layers, Bot, Send
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Endpoint {
  method: 'GET' | 'POST' | 'HEAD' | 'ALL'
  path: string
  title: string
  category: 'chat' | 'models' | 'media' | 'web' | 'metrics' | 'probes'
  description: string
  authRequired?: boolean
  isWebPage?: boolean
  sampleCurl?: string
  sampleBody?: string
  tag: string
}

const CATEGORIES = [
  { id: 'all', label: 'Todas as Páginas', icon: Layers },
  { id: 'chat', label: 'Chat & Completions', icon: Bot },
  { id: 'models', label: 'Modelos', icon: Sparkles },
  { id: 'media', label: 'Mídia & Arquivos', icon: Film },
  { id: 'web', label: 'Painéis Web', icon: Globe },
  { id: 'metrics', label: 'Métricas & Launcher', icon: Activity },
  { id: 'probes', label: 'Probes & Conectividade', icon: Server },
]

const ENDPOINTS: Endpoint[] = [
  // Chat
  {
    method: 'POST',
    path: '/v1/chat/completions',
    title: 'OpenAI Chat Completions',
    category: 'chat',
    tag: 'OpenAI API',
    description: 'Endpoint principal de conversação compatível com OpenAI. Suporta streaming SSE em tempo real, tool calling (function calling), modo Thinking/Raciocínio e busca web.',
    authRequired: true,
    sampleCurl: `curl -X POST http://127.0.0.1:50002/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer seu_token" \\
  -d '{
    "model": "qwen3.6-plus",
    "messages": [{"role": "user", "content": "Olá!"}],
    "stream": true
  }'`,
    sampleBody: `{
  "model": "qwen3.6-plus",
  "messages": [
    {"role": "user", "content": "Olá, como você pode me ajudar?"}
  ],
  "stream": true
}`,
  },
  {
    method: 'POST',
    path: '/v1/messages',
    title: 'Anthropic Messages API',
    category: 'chat',
    tag: 'Anthropic API',
    description: 'Endpoint de conversação nativo no formato Anthropic Claude Messages API. Compatível com Claude Code CLI, Cursor, Cline, Roo-Code e SDKs oficiais Anthropic.',
    authRequired: true,
    sampleCurl: `curl -X POST http://127.0.0.1:50002/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: seu_token" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-3-7-sonnet",
    "messages": [{"role": "user", "content": "Explique computação quântica"}],
    "stream": true
  }'`,
  },
  {
    method: 'POST',
    path: '/v1/chat/completions/stop',
    title: 'Interromper Stream',
    category: 'chat',
    tag: 'Controle',
    description: 'Cancela imediatamente o stream SSE em andamento para a sessão especificada, liberando o slot da conta no upstream.',
    sampleBody: `{"session_id": "chat_12345678"}`,
  },
  {
    method: 'POST',
    path: '/v1/completions',
    title: 'OpenAI Legacy Completions',
    category: 'chat',
    tag: 'OpenAI Legacy',
    description: 'Endpoint de texto tradicional (prompt string único) para compatibilidade com clientes antigos do ecossistema OpenAI.',
    authRequired: true,
  },
  {
    method: 'POST',
    path: '/v1/responses',
    title: 'OpenAI Responses API',
    category: 'chat',
    tag: 'OpenAI Preview',
    description: 'Endpoint experimental compatível com o novo formato Responses API da OpenAI.',
    authRequired: true,
  },

  // Modelos
  {
    method: 'GET',
    path: '/v1/models',
    title: 'Listagem de Modelos',
    category: 'models',
    tag: 'Catálogo',
    description: 'Retorna a lista completa de modelos suportados, com metadados de contexto, variantes (-fast, -thinking) e capacidades.',
    sampleCurl: `curl -X GET http://127.0.0.1:50002/v1/models`,
  },

  // Mídia & Upload
  {
    method: 'POST',
    path: '/v1/images/generations',
    title: 'Geração de Imagens',
    category: 'media',
    tag: 'Imagens',
    description: 'Gera imagens a partir de prompts de texto utilizando os modelos nativos de imagem do Qwen (qwen-image-* ou Wan2).',
    authRequired: true,
    sampleBody: `{
  "prompt": "Um gato astronauta explorando Marte em estilo aquarela",
  "model": "qwen-image-gen"
}`,
  },
  {
    method: 'POST',
    path: '/v1/videos/generations',
    title: 'Geração de Vídeos',
    category: 'media',
    tag: 'Vídeos',
    description: 'Inicia uma tarefa assíncrona de geração de vídeo a partir de texto ou imagem de referência via modelo Wan2.',
    authRequired: true,
  },
  {
    method: 'GET',
    path: '/v1/videos/tasks/:id',
    title: 'Status da Geração de Vídeo',
    category: 'media',
    tag: 'Vídeos',
    description: 'Consulta o progresso e o link do arquivo gerado de uma tarefa de renderização de vídeo Wan2.',
  },
  {
    method: 'POST',
    path: '/v1/files',
    title: 'Upload de Arquivos & Multimodal',
    category: 'media',
    tag: 'OSS Bucket',
    description: 'Recebe uploads multipart/form-data (imagens, PDFs, documentos) e os envia ao bucket OSS para anexar em conversas multimodais.',
  },

  // Painéis Web
  {
    method: 'GET',
    path: '/admin',
    title: 'Painel Admin Web (SPA)',
    category: 'web',
    tag: 'Interface Web',
    isWebPage: true,
    description: 'Interface web moderna completa em React SPA com visão geral em tempo real, gerenciamento de contas, playground, gráficos de uso, logs ao vivo e ajustes de runtime.',
  },
  {
    method: 'GET',
    path: '/dashboard',
    title: 'Dashboard Clássico Dodo (HTML)',
    category: 'web',
    tag: 'Interface Web',
    isWebPage: true,
    description: 'Dashboard leve em HTML estático integrado diretamente ao servidor para monitoramento rápido sem necessidade de autenticação.',
  },

  // Métricas & Launcher
  {
    method: 'GET',
    path: '/metrics/accounts',
    title: 'Métricas de Contas (Proxy Launcher)',
    category: 'metrics',
    tag: 'Dodo Launcher',
    description: 'Endpoint JSON consumido pelo aplicativo Desktop Proxy Launcher (Tauri) com o estado de cada conta, status de cooldown, memória RAM e streams ativos.',
    sampleCurl: `curl -X GET http://127.0.0.1:50002/metrics/accounts`,
  },
  {
    method: 'GET',
    path: '/accounts',
    title: 'Alias /accounts',
    category: 'metrics',
    tag: 'Dodo Launcher',
    description: 'Alias direto para `/metrics/accounts` com cabeçalhos CORS abertos para integração simplificada com ferramentas externas.',
  },
  {
    method: 'GET',
    path: '/health',
    title: 'Healthcheck & Watchdog',
    category: 'metrics',
    tag: 'Monitoramento',
    description: 'Verificação de integridade do servidor, relatando status do Watchdog, consumo de heap V8, memória RSS, streams e estatísticas de cache SQLite.',
    sampleCurl: `curl -X GET http://127.0.0.1:50002/health`,
  },
  {
    method: 'GET',
    path: '/api/dashboard/status',
    title: 'Status Resumido da API',
    category: 'metrics',
    tag: 'Dashboard API',
    description: 'Retorna estatísticas consolidadas de uptime, requisições por minuto, contas conectadas e slots livres.',
  },
  {
    method: 'GET',
    path: '/api/logs',
    title: 'Buffer de Logs (JSON)',
    category: 'metrics',
    tag: 'Logs API',
    description: 'Retorna o histórico circular dos últimos logs do console do servidor em formato JSON estruturado (parâmetro ?limit=50).',
  },
  {
    method: 'POST',
    path: '/api/actions/clear-cooldown',
    title: 'Limpar Cooldowns',
    category: 'metrics',
    tag: 'Ação Rápida',
    description: 'Remove instantaneamente o status de rate-limit/cooldown de todas as contas configuradas no gerenciador.',
  },
  {
    method: 'POST',
    path: '/api/actions/clear-cache',
    title: 'Limpar Cache',
    category: 'metrics',
    tag: 'Ação Rápida',
    description: 'Esvazia a tabela de cache SQLite e a memória RAM de respostas salvas.',
  },

  // Probes
  {
    method: 'ALL',
    path: '/api/hello',
    title: 'Probe de Conectividade (/api/hello)',
    category: 'probes',
    tag: 'Probe IA',
    description: 'Responde 200 OK para clientes e extensões de IA (Continue.dev, Ollama probes, Cline) que verificam a disponibilidade do host antes de enviar comandos.',
  },
  {
    method: 'ALL',
    path: '/api/version',
    title: 'Versão da API (/api/version)',
    category: 'probes',
    tag: 'Probe IA',
    description: 'Retorna a versão do backend em JSON para checagem rápida de compatibilidade.',
  },
]

export function PagesList() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  const handleCopy = (text: string, path: string) => {
    navigator.clipboard.writeText(text)
    setCopiedPath(path)
    toast.success('Copiado para a área de transferência!')
    setTimeout(() => setCopiedPath(null), 2000)
  }

  const filtered = useMemo(() => {
    return ENDPOINTS.filter((ep) => {
      const matchCat = activeCategory === 'all' || ep.category === activeCategory
      const matchSearch =
        search.trim() === '' ||
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        ep.title.toLowerCase().includes(search.toLowerCase()) ||
        ep.description.toLowerCase().includes(search.toLowerCase()) ||
        ep.tag.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [search, activeCategory])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="size-6 text-primary" />
            Catálogo de Páginas & Endpoints
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore e teste todas as rotas de API, dashboards, integrações e sondagens disponíveis no QwenBridge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
            {filtered.length} rotas disponíveis
          </Badge>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por rota, método, título ou descrição (ex: /v1/messages, SSE, dashboard, health)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                >
                  <Icon className="size-3.5" />
                  {cat.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Grid of Endpoints */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((ep) => {
          const isCopied = copiedPath === ep.path
          return (
            <Card key={`${ep.method}-${ep.path}`} className="flex flex-col justify-between border-border bg-card/60 transition-all hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        'font-mono text-xs font-bold uppercase tracking-wider',
                        ep.method === 'GET' && 'bg-emerald-600 text-white hover:bg-emerald-500',
                        ep.method === 'POST' && 'bg-blue-600 text-white hover:bg-blue-500',
                        ep.method === 'HEAD' && 'bg-amber-600 text-white hover:bg-amber-500',
                        ep.method === 'ALL' && 'bg-purple-600 text-white hover:bg-purple-500',
                      )}
                    >
                      {ep.method}
                    </Badge>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {ep.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {ep.authRequired && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px] gap-1 py-0">
                        <Shield className="size-3" /> Auth
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {ep.tag}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-base font-semibold pt-1">
                  {ep.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {ep.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                {ep.sampleBody && (
                  <div className="mb-3 rounded-md bg-muted/80 p-2.5 font-mono text-[11px] text-muted-foreground">
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground/80 pb-1 flex items-center gap-1">
                      <Code2 className="size-3" /> Exemplo de Payload:
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap">{ep.sampleBody}</pre>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleCopy(`http://127.0.0.1:50002${ep.path}`, ep.path)}
                  >
                    {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {isCopied ? 'Copiado!' : 'Copiar URL'}
                  </Button>

                  {ep.sampleCurl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => handleCopy(ep.sampleCurl!, `${ep.path}-curl`)}
                    >
                      <Send className="size-3" />
                      Copiar cURL
                    </Button>
                  )}

                  {ep.isWebPage && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      asChild
                    >
                      <a href={ep.path} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3" />
                        Abrir Página
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed bg-card/30">
            <Globe className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-base font-semibold text-foreground">Nenhum endpoint encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tente buscar por outro termo ou selecione a categoria "Todas as Páginas".
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
