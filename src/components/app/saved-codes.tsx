"use client"

import { useState } from "react"
import { Pencil, Pin, PinOff, Play, Plus, Trash } from "lucide-react"
import { toast } from "sonner"
import { Code } from "@/components/app/status"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isValidCode, sanitizeCodeInput } from "@/lib/ussd"
import type { SavedCode } from "@/lib/types"
import { useAppStore } from "@/store/app-store"

export function SavedCodes({ onUse }: { onUse: (code: string) => void }) {
  const codes = useAppStore((s) => s.codes)
  const addCode = useAppStore((s) => s.addCode)
  const updateCode = useAppStore((s) => s.updateCode)
  const removeCode = useAppStore((s) => s.removeCode)
  const [editing, setEditing] = useState<SavedCode | "new">()
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")

  const open = (c: SavedCode | "new") => {
    setEditing(c)
    setCode(c === "new" ? "" : c.code)
    setLabel(c === "new" ? "" : c.label)
  }

  const duplicate = codes.some((c) => c.code === code && (editing === "new" || c.id !== editing?.id))
  const codeError = code && !isValidCode(code) ? "Must start with * or # and end with #." : duplicate ? "This code is already saved." : undefined

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidCode(code) || duplicate || !label.trim()) return
    if (editing === "new") addCode({ code, label: label.trim(), pinned: true })
    else if (editing) updateCode(editing.id, { code, label: label.trim() })
    toast.success(editing === "new" ? "Code saved" : "Code updated")
    setEditing(undefined)
  }

  const sorted = [...codes].sort((a, b) => Number(b.pinned) - Number(a.pinned))

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>Saved codes</CardTitle>
        <CardDescription>Pinned codes appear as chips under the dial field</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => open("new")}><Plus /> Add</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          {sorted.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-2">
              <Code>{c.code}</Code>
              <span className="min-w-0 flex-1 truncate text-sm">{c.label}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Use ${c.code}`} onClick={() => onUse(c.code)}><Play /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={c.pinned ? "Unpin" : "Pin"} onClick={() => updateCode(c.id, { pinned: !c.pinned })}>
                {c.pinned ? <PinOff /> : <Pin />}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => open(c)}><Pencil /></Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                onClick={() => {
                  removeCode(c.id)
                  toast("Code removed", { action: { label: "Undo", onClick: () => addCode({ code: c.code, label: c.label, pinned: c.pinned }) } })
                }}
              >
                <Trash />
              </Button>
            </li>
          ))}
          {codes.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No saved codes.</li>}
        </ul>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Save a code" : "Edit code"}</DialogTitle>
            <DialogDescription>Deep links like *121*2# jump straight into a menu.</DialogDescription>
          </DialogHeader>
          <form id="code-form" onSubmit={save}>
            <FieldGroup>
              <Field data-invalid={!!codeError || undefined}>
                <FieldLabel htmlFor="code-value">USSD code</FieldLabel>
                <Input id="code-value" value={code} onChange={(e) => setCode(sanitizeCodeInput(e.target.value))} placeholder="*121#" inputMode="tel" className="font-mono" aria-invalid={!!codeError || undefined} />
                {codeError && <FieldDescription className="text-destructive">{codeError}</FieldDescription>}
              </Field>
              <Field>
                <FieldLabel htmlFor="code-label">Label</FieldLabel>
                <Input id="code-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Balance" />
              </Field>
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(undefined)}>Cancel</Button>
            <Button type="submit" form="code-form" disabled={!isValidCode(code) || duplicate || !label.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
