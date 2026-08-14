import { useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Download, Gauge, Layers, MemoryStick, Server, Wifi, WifiOff } from 'lucide-react'
import { fmtBytes, fmtSec } from '@/lib/api'
import { useLiveOverview } from '@/hooks/use-live'
import { AreaTrend, ChartCard, LineTrend, BarTrend, themeColor } from '@/components/charts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toPng } from 'html-to-image'

function Section({ icon: Icon, title, description, children }: { icon: any; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </div>
      {children}
    </section>
  )
}

function Kpi({ icon: Icon, label, value, suffix, tone, delta, deltaUp }: {
  icon: any
  label: string
  value: React.ReactNode
  suffix?: React.ReactNode
  tone?: 'ok' | 'warn' | 'bad'
  delta?: number | null
  deltaUp?: boolean
}) {
  const good = delta == null ? true : (delta >= 0) === deltaUp
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-400' : tone === 'ok' ? 'text-emerald-400' : ''}`}>
          {value}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {suffix ? <p className="min-w-0 truncate text-xs text-muted-foreground">{suffix}</p> : <span />}
          {delta != null ? (
            <span className={`flex shrink-0 items-center gap-0.5 font-mono text-xs ${good ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta).toLocaleString('pt-BR')}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function LoadBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const tone = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  )
}

function ConnBadge({ mode }: { mode: string }) {
  if (mode === 'live')
    return (
      <Badge variant="outline" className="gap-1.5 text-emerald-400">
        <Wifi className="size-3" /> tempo real
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1.5 text-amber-400">
      <WifiOff className="size-3" /> polling 4s
    </Badge>
  )
}

export function OverviewPage() {
  const { data, mode, lastUpdate } = useLiveOverview()
  const kpiRef = useRef<HTMLDivElement>(null)
  const [compareMode, setCompareMode] = useState(false)

  // True 1-minute rolling rate: sum the last 12 samples (each is a 5s count).
  // Not a ×12 extrapolation of a single 5s sample — otherwise 1 request in a
  // window would misleadingly display as "12 req/min".
  const rollingPerMin = (arr?: { t: number; v: number }[]) => {
    if (!arr) return []
    return arr.map((d, i) => ({
      t: d.t,
      v: Math.round(arr.slice(Math.max(0, i - 11), i + 1).reduce((a, b) => a + b.v, 0)),
    }))
  }

  const charts = useMemo(() => {
    if (!data?.series) return null
    return {
      requests: rollingPerMin(data.series.requests),
      completions: rollingPerMin(data.series.completions),
      errors: data.series.errors || [],
      latency: data.series.latency || [],
      streams: data.series.streams ?? [],
      memory: data.series.memory || [],
      sessions: data.series.sessions || [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const delta = (arr?: { t: number; v: number }[]): number | null => {
    if (!arr || arr.length < 5) return null
    const n = arr.length
    return Number((arr[n - 1].v - arr[n - 5].v).toFixed(1))
  }

  const busiestAccount = useMemo(() => {
    if (!data?.accounts.length) return null
    return data.accounts.reduce((max, acc) => (acc.activeLoad > max.activeLoad ? acc : max), data.accounts[0])
  }, [data])

  const handleExportPng = async () => {
    if (!kpiRef.current) return
    try {
      const dataUrl = await toPng(kpiRef.current, { backgroundColor: themeColor('--background', '#09090b'), pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `overview-kpis-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed', err)
    }
  }

  const errorTimerText = useMemo(() => {
    if (!data) return ''
    if (data.requestsErrors === 0) {
      const uptimeHours = Math.floor(data.uptime / 3600000)
      if (uptimeHours > 0) return `sem erros há ${uptimeHours}h`
      return 'sem erros'
    }
    return 'último erro recente'
  }, [data])

  return (
    <div className="flex flex-col gap-8">
      <Section icon={Activity} title="Indicadores" description="resumo do proxy em tempo real">
        <div ref={kpiRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi
            icon={Activity}
            label="Completions"
            value={data?.requestsCompletions.toLocaleString('pt-BR') ?? '…'}
            suffix={charts ? `${charts.completions[charts.completions.length - 1]?.v ?? 0} req/min agora · ${data?.requestsTotal?.toLocaleString('pt-BR') ?? 0} total` : '…'}
            delta={delta(charts?.completions)}
            deltaUp
          />
          <Kpi
            icon={AlertTriangle}
            label="Erros"
            value={data?.requestsErrors ?? '…'}
            tone={data && data.requestsErrors ? 'bad' : 'ok'}
            suffix={data ? `${data.requestsSuccessRate.toFixed(1)}% sucesso · ${data.requests4xx ?? 0} 4xx · ${data.requests5xx ?? 0} 5xx · ${errorTimerText}` : ''}
            delta={delta(charts?.errors)}
          />
          <Kpi
            icon={Gauge}
            label="Latência p/ resposta"
            value={data ? `${data.latencyCompletion?.count ? Math.round(data.latencyCompletion.sum / data.latencyCompletion.count) : 0}ms` : '…'}
            suffix={data && `avg req: ${data.latency?.count ? Math.round(data.latency.sum / data.latency.count) : 0}ms`}
            delta={delta(charts?.latency)}
          />
          <Kpi
            icon={Layers}
            label="Streams ativos"
            value={data?.activeStreamsMetric ?? '…'}
            suffix={data ? `${data.totalUserStreams ?? 0} em usuários` : ''}
            tone="ok"
            delta={delta(charts?.streams)}
            deltaUp
          />
          <Kpi
            icon={Server}
            label="Sessões"
            value={data?.sessionCount ?? '…'}
            delta={delta(charts?.sessions)}
            deltaUp
          />
          <Kpi
            icon={MemoryStick}
            label="Memória (RSS)"
            value={data ? `${data.memory.pct.toFixed(1)}%` : '…'}
            tone={data && data.memory.pct > 85 ? 'bad' : data && data.memory.pct > 70 ? 'warn' : undefined}
            suffix={data && `${fmtBytes(data.memory.rss)} / ${fmtBytes(data.memory.systemTotal)}`}
            delta={delta(charts?.memory)}
          />
        </div>
      </Section>

      {charts ? (
        <Section icon={BarChart3} title="Tráfego e desempenho" description="evolução na última janela de 20 minutos">
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Completions / min" icon={BarChart3} badge={<ConnBadge mode={mode} />}>
              <BarTrend data={charts.completions} color="#34d399" unit="req/min" height={220} />
            </ChartCard>
            <ChartCard title="Latência até início da resposta" icon={Gauge} badge={data?.latencyCompletion?.count ? <Badge variant="secondary" className="font-mono">{Math.round((data.latencyCompletion?.sum ?? 0) / (data.latencyCompletion?.count || 1))}ms</Badge> : undefined}>
              <LineTrend data={charts.latency} color="#f5b842" unit="ms" height={220} />
            </ChartCard>
            <ChartCard title="Requisições totais / min" icon={Activity} badge={charts.requests.length ? <Badge variant="secondary" className="font-mono">{charts.requests[charts.requests.length - 1].v} agora</Badge> : undefined}>
              <BarTrend data={charts.requests} color="#5ee6d6" unit="req/min" height={220} />
            </ChartCard>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ChartCard title="Erros por intervalo" icon={AlertTriangle} badge={<Badge variant="secondary" className="font-mono">{charts.errors.reduce((a, b) => a + b.v, 0)} total</Badge>}>
              <BarTrend data={charts.errors} color="#ff6b5e" unit="erros" height={140} />
            </ChartCard>
            <ChartCard title="Streams ativos" icon={Layers} badge={<Badge variant="secondary" className="font-mono">{data?.activeStreamsMetric || 0}</Badge>}>
              <AreaTrend data={charts.streams} color="#5ee6d6" unit="streams" height={140} />
            </ChartCard>
            <ChartCard title="Memória (RSS % do sistema)" icon={MemoryStick} badge={<Badge variant="secondary" className="font-mono">{charts.memory.length ? `${charts.memory[charts.memory.length - 1]?.v ?? 0}%` : '—'}</Badge>}>
              <AreaTrend data={charts.memory} color="#a78bfa" unit="%" height={140} />
            </ChartCard>
          </div>
        </Section>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      )}

      <Section icon={Server} title="Infraestrutura" description="contas, lanes e pool aquecido">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contas · carga</CardTitle>
              <CardDescription>Lanes configurados: {data?.lanes ?? '—'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="w-32">Carga / cap</TableHead>
                    <TableHead className="w-24">Streams</TableHead>
                    <TableHead className="w-20">Estado</TableHead>
                    <TableHead className="text-right">Cooldown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data && data.accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Nenhuma conta configurada
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.accounts.map((a) => (
                      <TableRow key={a.id} className={busiestAccount?.id === a.id ? 'bg-amber-500/10' : ''}>
                        <TableCell className="font-mono text-xs">
                          {a.email}
                          {busiestAccount?.id === a.id && (
                            <Badge variant="outline" className="ml-2 text-amber-400">mais carregada</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <LoadBar value={a.activeLoad} max={Math.max(1, data?.maxStreamsPerAccount || 2)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{a.streams ?? 0}</TableCell>
                        <TableCell>
                          {a.ready ? (
                            <Badge variant="outline" className="text-emerald-400">pronta</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-400">aquecendo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.cooldown > 0 ? (
                            <Badge variant="outline" className="text-amber-400">
                              {fmtSec(a.cooldown / 1000)}
                              {a.cooldownReason ? ` · ${a.cooldownReason}` : ''}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-400">
                              ok
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Warm pool</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {!data || Object.keys(data.warmPool).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem chats aquecidos no momento</p>
                  ) : (
                    Object.entries(data.warmPool).map(([k, v]) => (
                      <div key={k} className="rounded-lg border bg-muted/20 px-3 py-2">
                        <div className="font-mono text-xs text-muted-foreground">{k}</div>
                        <div className="text-lg font-bold">{v}</div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado geral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contas ativas</span>
                  <span className="font-mono">{data?.inUseAccounts.length ?? '—'} / {data?.accounts.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Streams em uso</span>
                  <span className="font-mono">{data?.activeStreamsMetric ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lanes prontas</span>
                  <span className="font-mono">{data?.readyAccountCount ?? 0} / {data?.accounts.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cap streams / conta</span>
                  <span className="font-mono">{data?.maxStreamsPerAccount ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CPU load 1min</span>
                  <span className="font-mono">{data?.cpu?.load1m != null ? data.cpu.load1m.toFixed(2) : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Watchdog</span>
                  {data?.watchdog?.overall === 0 ? (
                    <Badge variant="outline" className="text-emerald-400">saudável</Badge>
                  ) : data?.watchdog?.overall === 1 ? (
                    <Badge variant="outline" className="text-amber-400">degradado</Badge>
                  ) : data?.watchdog ? (
                    <Badge variant="outline" className="text-red-400">crítico</Badge>
                  ) : (
                    <span className="font-mono">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Limite por usuário</span>
                  <span className="font-mono">{data?.userRateLimitRpm ?? '—'} rpm</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Última atualização: {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '…'} · janela 20min · conexão: {mode}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
          >
            vs. período anterior
          </Button>
          {compareMode && <Badge variant="secondary">Comparação ativa</Badge>}
          <Button variant="outline" size="sm" onClick={handleExportPng}>
            <Download className="size-3.5 mr-1.5" />
            Exportar PNG
          </Button>
        </div>
      </div>
    </div>
  )
}