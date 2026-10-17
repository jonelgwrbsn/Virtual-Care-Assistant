import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionCard, SectionCardSkeleton } from "@/components/dashboard/Cards";
import { FileText, Download, Eye, Pill, FlaskConical, Stethoscope, Upload, Trash2, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePatientRecords } from "@/hooks/use-supabase-data";
import { UploadRecordModal } from "@/components/UploadRecordModal";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  consultation: { icon: Stethoscope, color: "text-primary bg-primary/10",     label: "Consultation" },
  lab_result:   { icon: FlaskConical, color: "text-secondary bg-secondary/10", label: "Lab Result" },
  prescription: { icon: Pill,         color: "text-success bg-success/10",     label: "Prescription" },
  summary:      { icon: FileText,     color: "text-warning bg-warning/10",     label: "Summary" },
  other:        { icon: FileText,     color: "text-muted-foreground bg-muted", label: "Other" },
};

const Records = () => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data: records, loading, error } = usePatientRecords(refetchKey);

  const getSignedUrl = async (fileUrl: string): Promise<string | null> => {
    try {
      // fileUrl is either a storage path (new) or a full URL (legacy)
      let path = fileUrl;
      if (fileUrl.startsWith("http")) {
        // Legacy: extract path from full URL
        const match = fileUrl.match(/medical-records\/(.+?)(\?|$)/);
        if (!match) return null;
        path = match[1];
      }
      const { data, error } = await supabase.storage
        .from("medical-records")
        .createSignedUrl(path, 120); // 2 min expiry
      if (error || !data) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  };

  const handleView = async (r: any) => {
    if (!r.file_url) { toast.info("No file attached to this record."); return; }
    const url = await getSignedUrl(r.file_url);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open file. Please try again.");
  };

  const handleDownload = async (r: any) => {
    if (!r.file_url) { toast.info("No file attached to this record."); return; }
    const url = await getSignedUrl(r.file_url);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = r.title;
      a.click();
    } else {
      toast.error("Could not download file. Please try again.");
    }
  };

  const handleDelete = async (r: any) => {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    setDeletingId(r.id);
    try {
      const { error } = await supabase.from("medical_records").delete().eq("id", r.id);
      if (error) throw error;
      toast.success("Record deleted");
      setRefetchKey(k => k + 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout requiredRole="patient">
      <UploadRecordModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setRefetchKey(k => k + 1)}
      />

      <div className="mb-7">
        <p className="text-sm text-muted-foreground">Your health history</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Medical Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">All your consultations, prescriptions, and lab reports in one secure place.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load records: {error}
        </p>
      )}

      {loading ? (
        <SectionCardSkeleton rows={5} />
      ) : (
        <SectionCard
          title={`${records?.length ?? 0} documents`}
          action={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload record
            </Button>
          }
        >
          {records && records.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {records.map((r: any) => {
                const cfg = typeConfig[r.record_type] ?? typeConfig.other;
                const Icon = cfg.icon;
                const uploader = (r.uploader as any)?.full_name ?? "Unknown";
                return (
                  <li key={r.id} className="flex items-center gap-4 py-3.5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {uploader} · {r.recorded_date ? format(new Date(r.recorded_date), "MMM d, yyyy") : "—"}
                      </div>
                      {r.notes && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.notes}</div>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {cfg.label}
                      </span>
                      {r.file_url
                        ? <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success"><Paperclip className="h-3 w-3" /> File</span>
                        : <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground/50">No file</span>
                      }
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleView(r)} title="View"
                        className={!r.file_url ? "opacity-30 cursor-not-allowed" : ""}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(r)} title="Download"
                        className={!r.file_url ? "opacity-30 cursor-not-allowed" : ""}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        disabled={deletingId === r.id}
                        onClick={() => handleDelete(r)}
                        title="Delete"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {deletingId === r.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No records yet.</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> Upload your first document
              </Button>
            </div>
          )}
        </SectionCard>
      )}
    </DashboardLayout>
  );
};
export default Records;
