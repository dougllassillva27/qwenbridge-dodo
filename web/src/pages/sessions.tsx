import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { api, fmtSec, type SessionInfo } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api.sessions()
      setSessions(data)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao carregar sessões')
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [load])

  async function deleteSession(key: string) {
    try {
      await api.deleteSession(key)
      toast.success('Sessão removida')
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao remover sessão')
    }
  }

  async function clearAll() {
    if (!confirm('Remover todas as sessões?')) return
    try {
      await api.clearSessions()
      toast.success('Todas as sessões removidas')
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao limpar sessões')
    }
  }

  const filtered = sessions.filter(
    (s) =>
      s.sessionKey.toLowerCase().includes(search.toLowerCase()) ||
      s.chatId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Sessões</CardTitle>
              <CardDescription>{sessions.length} sessão(ões) ativa(s)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={load}>
                <RefreshCw /> Atualizar
              </Button>
              <Button size="sm" variant="destructive" onClick={clearAll}>
                <Trash2 /> Limpar todas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por session key ou chat ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session Key</TableHead>
                <TableHead>Chat ID</TableHead>
                <TableHead>Account ID</TableHead>
                <TableHead>History</TableHead>
                <TableHead>TTL</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    {sessions.length === 0 ? 'Nenhuma sessão ativa' : 'Nenhum resultado encontrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.sessionKey}>
                    <TableCell className="font-mono text-xs">
                      {s.sessionKey.slice(0, 16)}…
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.chatId.slice(0, 12)}…
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.accountId.slice(0, 12)}…
                    </TableCell>
                    <TableCell>
                      {s.historyComplete ? (
                        <Badge variant="outline" className="text-emerald-400">complete</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-400">bootstrap</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          s.ttlRemaining > 3600
                            ? 'text-emerald-400'
                            : s.ttlRemaining > 600
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }
                      >
                        {fmtSec(s.ttlRemaining)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {timeAgo(s.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => deleteSession(s.sessionKey)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
