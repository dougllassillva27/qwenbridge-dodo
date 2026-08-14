import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Plus, Pencil, RefreshCw, Trash2, Copy } from 'lucide-react'
import { api, genKey, type AdminUser } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface EditorState {
  mode: 'create' | 'edit'
  id?: string
  email: string
  apiKey: string
  rateLimitRpm: string
  maxConcurrency: string
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setUsers(await api.users())
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao carregar usuários')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!editor) return
    setBusy(true)
    try {
      const payload = {
        email: editor.email || editor.id || 'user',
        apiKey: editor.apiKey,
        rateLimitRpm: Number(editor.rateLimitRpm) || 0,
        maxConcurrency: Number(editor.maxConcurrency) || 0,
      }
      if (editor.mode === 'create') {
        await api.createUser(payload)
        toast.success(`Key criada: ${editor.apiKey}`)
      } else {
        await api.updateUser(editor.id!, payload)
        toast.success('Usuário atualizado')
      }
      setEditor(null)
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys de usuários</CardTitle>
          <CardDescription>{users.length} chave(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead className="text-right">RPM</TableHead>
                <TableHead className="text-right">Concorrência</TableHead>
                <TableHead className="text-right">Streams</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Nenhuma chave — crie a primeira abaixo
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email ?? u.id}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {u.apiKey}
                        <button
                          className="rounded p-0.5 hover:bg-accent"
                          onClick={() => {
                            navigator.clipboard.writeText(u.apiKey)
                            toast.success('Chave copiada')
                          }}
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{u.rateLimitRpm}</TableCell>
                    <TableCell className="text-right">{u.maxConcurrency}</TableCell>
                    <TableCell className="text-right">{u.activeStreams}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() =>
                          setEditor({ mode: 'edit', id: u.id, email: u.email ?? '', apiKey: u.apiKey, rateLimitRpm: String(u.rateLimitRpm), maxConcurrency: String(u.maxConcurrency) })}>
                          <Pencil />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => api.updateUser(u.id, { apiKey: genKey() }).then(() => {
                          toast.success('Nova chave gerada. Copie antes de fechar.')
                          load()
                        })}>
                          <RefreshCw />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={async () => {
                          if (!confirm(`Remover usuário ${u.email ?? u.id}?`)) return
                          await api.deleteUser(u.id)
                          load()
                        }}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova chave</CardTitle>
          <CardDescription>Limites por usuário: RPM e concorrência máxima simultânea</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              setEditor({
                mode: 'create',
                email: '',
                apiKey: genKey(),
                rateLimitRpm: '120',
                maxConcurrency: '8',
              })
            }
          >
            <KeyRound /> Criar nova chave
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.mode === 'create' ? 'Nova API key' : 'Editar usuário'}</DialogTitle>
            <DialogDescription>
              {editor?.mode === 'create' ? 'Copie a chave gerada antes de fechar esta janela.' : 'Ajuste os limites do usuário.'}
            </DialogDescription>
          </DialogHeader>
          {editor ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Rótulo / e-mail</Label>
                <Input value={editor.email} onChange={(e) => setEditor({ ...editor, email: e.target.value })} placeholder="usuario1" />
              </div>
              <div className="grid gap-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input className="font-mono" value={editor.apiKey} readOnly={editor.mode === 'create'} onChange={(e) => setEditor({ ...editor, apiKey: e.target.value })} />
                  {editor.mode === 'create' ? (
                    <Button variant="outline" onClick={() => setEditor({ ...editor, apiKey: genKey() })}>
                      gerar
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>RPM</Label>
                  <Input type="number" value={editor.rateLimitRpm} onChange={(e) => setEditor({ ...editor, rateLimitRpm: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Concorrência</Label>
                  <Input type="number" value={editor.maxConcurrency} onChange={(e) => setEditor({ ...editor, maxConcurrency: e.target.value })} />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={save}>
              <Plus /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}