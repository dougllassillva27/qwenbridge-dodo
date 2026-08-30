import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Cpu,
  HardDrive,
  Hammer,
  MemoryStick,
  Play,
  Power,
  RefreshCw,
  ScrollText,
  Square,
  Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, fmtBytes } from '@/lib/api'
import type { DockerContainer, DockerSystemStats } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

/* ------------------------------------------------------------------ */
/*  Neon palette                                                       */
/* ------------------------------------------------------------------ */
const C = {
  cyan: '#00e5ff',
  green: '#00ff9d',
  red: '#ff3b5c',
  blue: '#3b82f6',
  purple: '#a855f7',
  bg: '#050a18',
  card: '#0c1429',
} as const

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function isRunning(c: DockerContainer) {
  return c.state === 'running' || c.status.toLowerCase().includes('up')
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Progress bar with neon gradient */
function NeonBar({
  percent,
  color,
  label,
  sub,
}: {
  percent: number
  color: string
  label: string
  sub?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono" style={{ color }}>
          {clamped.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
      {sub && (
        <p className="font-mono text-[10px] text-slate-500">{sub}</p>
      )}
    </div>
  )
}

/** System resource card */
function ResourceCard({
  icon: Icon,
  title,
  percent,
  color,
  detail,
  sub,
}: {
  icon: React.ElementType
  title: string
  percent: number
  color: string
  detail?: string
  sub?: string
}) {
  return (
    <Card
      className="border border-white/5"
      style={{ background: C.card }}
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <div
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ background: `${color}18` }}
        >
          <Icon className="size-5" style={{ color }} />
        </div>
        <CardTitle className="text-sm font-semibold text-slate-200">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <NeonBar percent={percent} color={color} label="Utilização" sub={sub} />
        {detail && (
          <p className="font-mono text-xs text-slate-400">{detail}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Status badge for containers */
function StatusBadge({ running }: { running: boolean }) {
  return running ? (
    <Badge
      variant="outline"
      className="gap-1 border-emerald-500/30 text-emerald-400"
      style={{ boxShadow: `0 0 6px ${C.green}33` }}
    >
      <span className="relative flex size-2">
        <span
          className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
          style={{ background: C.green }}
        />
        <span
          className="relative inline-flex size-2 rounded-full"
          style={{ background: C.green }}
        />
      </span>
      RUNNING
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="gap-1 border-red-500/30 text-red-400"
    >
      <Square className="size-2 fill-current" />
      STOPPED
    </Badge>
  )
}

/** Metric pill inside container card */
function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className="font-mono text-xs font-medium text-slate-300"
        style={color ? { color } : undefined}
      >
        {value || '—'}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export function DockerPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [sys, setSys] = useState<DockerSystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [logsOpen, setLogsOpen] = useState(false)
  const [, setLogsId] = useState<string | null>(null)
  const [logsName, setLogsName] = useState('')
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [composeLoading, setComposeLoading] = useState<string | null>(null)

  /* ---- compose actions ---- */
  const handleCompose = async (action: 'up' | 'rebuild' | 'restart' | 'down') => {
    const labels: Record<string, string> = { up: 'Iniciando', rebuild: 'Reconstruindo', restart: 'Reiniciando', down: 'Parando' }
    setComposeLoading(action)
    try {
      const res = await api.dockerCompose(action)
      if (res.ok) {
        toast.success(`${labels[action]}: todos os containers`)
        await refresh()
      } else {
        toast.error(`Erro em ${action}: ${res.error ?? 'desconhecido'}`)
      }
    } catch (err: any) {
      toast.error(`Erro em ${action}: ${err?.message ?? err}`)
    } finally {
      setComposeLoading(null)
    }
  }

  /* ---- data fetching ---- */
  const refresh = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api.dockerContainers(),
        api.dockerSystem(),
      ])
      setContainers(cRes.containers ?? [])
      setSys(sRes)
    } catch (err: any) {
      toast.error(`Falha ao carregar dados Docker: ${err?.message ?? err}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15_000)
    return () => clearInterval(id)
  }, [refresh])

  /* ---- actions ---- */
  const handleAction = async (
    id: string,
    name: string,
    action: 'start' | 'stop' | 'restart' | 'rebuild',
  ) => {
    setActionLoading((p) => ({ ...p, [id]: true }))
    try {
      await api.dockerAction(id, action)
      toast.success(
        `${action === 'start' ? 'Iniciado' : action === 'stop' ? 'Parado' : action === 'rebuild' ? 'Reconstruído' : 'Reiniciado'}: ${name}`,
      )
      await refresh()
    } catch (err: any) {
      toast.error(`Erro em ${action} (${name}): ${err?.message ?? err}`)
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }))
    }
  }

  const openLogs = async (id: string, name: string) => {
    setLogsId(id)
    setLogsName(name)
    setLogs('')
    setLogsOpen(true)
    setLogsLoading(true)
    try {
      const res = await api.dockerLogs(id)
      setLogs(res.logs ?? '')
    } catch (err: any) {
      toast.error(`Erro ao buscar logs: ${err?.message ?? err}`)
    } finally {
      setLogsLoading(false)
    }
  }

  // auto-scroll logs
  useEffect(() => {
    if (logsOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, logsOpen])

  /* ---- derived values ---- */
  const ramPct = sys?.ram.percent ?? 0
  const diskPct = sys?.disk.percent ?? 0
  const cpuLoad1m = sys?.cpu_load['1m'] ?? 0
  const cpuCores = sys?.cpu_cores || 1
  const cpuPct = Math.min(100, (cpuLoad1m / cpuCores) * 100)

  /* ---- render ---- */
  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6" style={{ background: C.bg, minHeight: '100vh' }}>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-8 p-6"
      style={{ background: C.bg, minHeight: '100vh' }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl"
            style={{ background: `${C.cyan}18` }}
          >
            <Box className="size-6" style={{ color: C.cyan }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Docker Manager</h1>
            <p className="text-xs text-slate-500">
              Monitoramento e controle de containers · Auto-refresh 15s
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Compose global actions */}
          <Button
            size="sm"
            disabled={!!composeLoading}
            onClick={() => handleCompose('up')}
            className="bg-emerald-600/80 text-xs text-white hover:bg-emerald-500"
          >
            {composeLoading === 'up' ? <RefreshCw className="mr-1.5 size-3.5 animate-spin" /> : <Play className="mr-1.5 size-3.5" />}
            Iniciar tudo
          </Button>
          <Button
            size="sm"
            disabled={!!composeLoading}
            onClick={() => handleCompose('rebuild')}
            className="bg-blue-600/80 text-xs text-white hover:bg-blue-500"
          >
            {composeLoading === 'rebuild' ? <RefreshCw className="mr-1.5 size-3.5 animate-spin" /> : <Hammer className="mr-1.5 size-3.5" />}
            Reconstruir
          </Button>
          <Button
            size="sm"
            disabled={!!composeLoading}
            onClick={() => handleCompose('restart')}
            className="bg-amber-600/80 text-xs text-white hover:bg-amber-500"
          >
            {composeLoading === 'restart' ? <RefreshCw className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
            Reiniciar
          </Button>
          <Button
            size="sm"
            disabled={!!composeLoading}
            onClick={() => handleCompose('down')}
            className="bg-red-600/80 text-xs text-white hover:bg-red-500"
          >
            {composeLoading === 'down' ? <RefreshCw className="mr-1.5 size-3.5 animate-spin" /> : <Power className="mr-1.5 size-3.5" />}
            Parar tudo
          </Button>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              refresh()
            }}
            className="border-white/10 text-slate-300 hover:bg-white/5"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* System Resources */}
      <section className="grid gap-4 md:grid-cols-3">
        <ResourceCard
          icon={Cpu}
          title="CPU Load"
          percent={cpuPct}
          color={C.cyan}
          detail={`Load avg: ${cpuLoad1m.toFixed(2)} / ${sys?.cpu_load['5m'].toFixed(2)} / ${sys?.cpu_load['15m'].toFixed(2)} · ${cpuCores} cores`}
        />
        <ResourceCard
          icon={MemoryStick}
          title="Memory"
          percent={ramPct}
          color={C.green}
          detail={`${fmtBytes(sys?.ram.used_kb ? sys.ram.used_kb * 1024 : undefined)} / ${fmtBytes(sys?.ram.total_kb ? sys.ram.total_kb * 1024 : undefined)}`}
        />
        <ResourceCard
          icon={HardDrive}
          title="Disk"
          percent={diskPct}
          color={C.purple}
          detail={`${fmtBytes(sys?.disk.used)} / ${fmtBytes(sys?.disk.total)}`}
        />
      </section>

      {/* Containers grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Containers
          </h2>
          <Badge variant="secondary" className="ml-auto font-mono text-xs">
            {containers.length}
          </Badge>
        </div>

        {containers.length === 0 ? (
          <Card className="border border-white/5" style={{ background: C.card }}>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Box className="mb-3 size-10 opacity-40" />
              <p>Nenhum container encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {containers.map((c) => {
              const running = isRunning(c)
              const busy = !!actionLoading[c.id]
              return (
                <Card
                  key={c.id}
                  className="group relative overflow-hidden border border-white/5 transition-all hover:border-white/10"
                  style={{ background: C.card }}
                >
                  {/* Glow accent on top */}
                  <div
                    className="absolute left-0 right-0 top-0 h-[2px]"
                    style={{
                      background: running
                        ? `linear-gradient(90deg, transparent, ${C.green}, transparent)`
                        : `linear-gradient(90deg, transparent, ${C.red}66, transparent)`,
                    }}
                  />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-sm font-semibold text-white">
                          {c.name}
                        </CardTitle>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                          {c.image}
                        </p>
                      </div>
                      <StatusBadge running={running} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Metrics grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <Metric
                        label="CPU%"
                        value={c.cpu ?? '—'}
                        color={C.cyan}
                      />
                      <Metric
                        label="MEM%"
                        value={c.mem_percent ?? '—'}
                        color={C.green}
                      />
                      <Metric
                        label="PIDs"
                        value={c.pids ?? '—'}
                        color={C.blue}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label="MEM USAGE"
                        value={c.mem_usage ?? '—'}
                      />
                      <Metric
                        label="NET I/O"
                        value={c.net_io ?? '—'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Metric
                        label="BLOCK I/O"
                        value={c.block_io ?? '—'}
                      />
                      <Metric
                        label="PORTS"
                        value={c.ports || '—'}
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {running ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleAction(c.id, c.name, 'stop')}
                            className="flex-1 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Square className="mr-1 size-3 fill-current" />
                            STOP
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleAction(c.id, c.name, 'restart')}
                            className="flex-1 border-blue-500/30 text-xs text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                          >
                            <RefreshCw className="mr-1 size-3" />
                            RESTART
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleAction(c.id, c.name, 'start')}
                          className="flex-1 border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        >
                          <Play className="mr-1 size-3 fill-current" />
                          START
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          const msg = c.name === 'qwenbridge'
                            ? 'Reconstruir o QWENBRIDGE? O assistente (Hermes) roda através dele e a conversa pode cair durante o processo.'
                            : 'Reconstruir ' + c.name + '? A imagem será refeita e o container será recriado.'
                          if (window.confirm(msg)) handleAction(c.id, c.name, 'rebuild')
                        }}
                        className="flex-1 border-amber-500/30 text-xs text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                      >
                        <Hammer className="mr-1 size-3" />
                        REBUILD
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => openLogs(c.id, c.name)}
                        className="flex-1 border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
                      >
                        <ScrollText className="mr-1 size-3" />
                        LOGS
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Logs modal */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent
          className="max-w-4xl border border-white/10 sm:max-w-4xl"
          style={{ background: '#0a0f1e' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-white">
              <ScrollText className="size-4" style={{ color: C.purple }} />
              Logs — {logsName}
            </DialogTitle>
          </DialogHeader>

          <div
            className="max-h-[65vh] overflow-auto rounded-lg border border-white/5 p-4 font-mono text-xs leading-relaxed"
            style={{ background: '#060b16' }}
          >
            {logsLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Carregando logs…
              </div>
            ) : logs ? (
              <pre className="whitespace-pre-wrap break-all text-slate-300">
                {logs}
              </pre>
            ) : (
              <p className="py-12 text-center text-slate-600">
                Nenhum log disponível
              </p>
            )}
            <div ref={logsEndRef} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
