import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Brain } from "lucide-react";
import { useSymptomKnowledge, upsertSymptomKnowledge, deleteSymptomKnowledge } from "@/hooks/use-supabase-data";
import { toast } from "sonner";

const confidenceColors: Record<string, string> = {
  high: "bg-success/15 text-success",
  moderate: "bg-warning/15 text-warning",
  low: "bg-destructive/15 text-destructive",
};
const levelColors: Record<string, string> = {
  monitor: "bg-success/15 text-success",
  consult: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

const empty = { id: undefined as string | undefined, keywords: "", condition: "", confidence: "moderate", advice: "", recommendation_level: "monitor", recommendation_text: "" };

export default function KnowledgeBase() {
  const [refetchKey, setRefetchKey] = useState(0);
  const { data: entries, loading } = useSymptomKnowledge(refetchKey);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const openNew = () => { setForm({ ...empty }); setOpen(true); };
  const openEdit = (e: any) => {
    setForm({
      id: e.id,
      keywords: e.keywords.join(", "),
      condition: e.condition,
      confidence: e.confidence,
      advice: e.advice.join("\n"),
      recommendation_level: e.recommendation_level,
      recommendation_text: e.recommendation_text,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.condition.trim() || !form.keywords.trim() || !form.advice.trim() || !form.recommendation_text.trim())
      return toast.error("All fields are required");
    setSaving(true);
    try {
      await upsertSymptomKnowledge({
        id: form.id,
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
        condition: form.condition.trim(),
        confidence: form.confidence,
        advice: form.advice.split("\n").map(a => a.trim()).filter(Boolean),
        recommendation_level: form.recommendation_level,
        recommendation_text: form.recommendation_text.trim(),
      });
      toast.success(form.id ? "Entry updated" : "Entry added");
      setOpen(false);
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteSymptomKnowledge(id);
      toast.success("Entry deleted");
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <DashboardLayout requiredRole="admin">
      <div className="mb-7 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Chatbot intelligence</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the symptom entries the care chatbot uses to respond.</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Add entry
        </Button>
      </div>

      {loading ? <SectionCardSkeleton rows={6} /> : (
        <SectionCard title={`${entries?.length ?? 0} conditions`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4">Condition</th>
                  <th className="pb-3 pr-4 hidden sm:table-cell">Keywords</th>
                  <th className="pb-3 pr-4">Confidence</th>
                  <th className="pb-3 pr-4">Level</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(entries ?? []).map((e: any) => (
                  <tr key={e.id} className="hover:bg-accent/40">
                    <td className="py-3 pr-4 font-medium">{e.condition}</td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {e.keywords.slice(0, 4).map((k: string) => (
                          <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{k}</span>
                        ))}
                        {e.keywords.length > 4 && <span className="text-[10px] text-muted-foreground">+{e.keywords.length - 4}</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${confidenceColors[e.confidence]}`}>{e.confidence}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${levelColors[e.recommendation_level]}`}>{e.recommendation_level}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" disabled={deleting === e.id} onClick={() => handleDelete(e.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          {deleting === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> {form.id ? "Edit entry" : "Add entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Condition name</Label>
              <Input placeholder="e.g. Tension headache" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Keywords <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
              <Input placeholder="headache, head pain, migraine" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Confidence</Label>
                <Select value={form.confidence} onValueChange={v => setForm(f => ({ ...f, confidence: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Recommendation level</Label>
                <Select value={form.recommendation_level} onValueChange={v => setForm(f => ({ ...f, recommendation_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monitor">Monitor</SelectItem>
                    <SelectItem value="consult">Consult</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Advice <span className="text-muted-foreground font-normal">(one per line)</span></Label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder={"Rest in a quiet room\nStay hydrated\nTake OTC pain relief if needed"}
                value={form.advice}
                onChange={e => setForm(f => ({ ...f, advice: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Recommendation text</Label>
              <Input placeholder="Seek care if symptoms worsen after 48 hours." value={form.recommendation_text} onChange={e => setForm(f => ({ ...f, recommendation_text: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? "Save changes" : "Add entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
