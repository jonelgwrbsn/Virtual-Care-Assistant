import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

export const UploadRecordModal = ({ open, onClose, onUploaded }: Props) => {
  const session = getSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading]   = useState(false);
  const [title, setTitle]       = useState("");
  const [type, setType]         = useState("consultation");
  const [notes, setNotes]       = useState("");
  const [file, setFile]         = useState<File | null>(null);

  const handleUpload = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!session) return toast.error("Not logged in");

    setLoading(true);
    try {
      let fileUrl: string | null = null;

      if (file) {
        const ext  = file.name.split(".").pop();
        const path = `${session.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("medical-records")
          .upload(path, file, { upsert: false });

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        // Store the storage path so we can generate signed URLs later
        fileUrl = path;
      }

      const { error } = await supabase.from("medical_records").insert({
        patient_id:    session.id,
        uploaded_by:   session.id,
        title:         title.trim(),
        record_type:   type,
        notes:         notes.trim() || null,
        file_url:      fileUrl,
        recorded_date: new Date().toISOString().split("T")[0],
      });

      if (error) throw error;

      toast.success("Record uploaded successfully");
      onUploaded?.();
      onClose();
      setTitle(""); setNotes(""); setType("consultation"); setFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Upload medical record
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rec-title">Document title</Label>
            <Input
              id="rec-title"
              placeholder="e.g. Blood test results — April 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Record type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation notes</SelectItem>
                <SelectItem value="lab_result">Lab result</SelectItem>
                <SelectItem value="prescription">Prescription</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="rec-notes"
              placeholder="Brief description of the document"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>File <span className="text-muted-foreground">(optional)</span></Label>
            <input ref={fileRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <FileText className="h-4 w-4 shrink-0" />
              {file ? file.name : "Click to attach a file (PDF, image, doc)"}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={loading} className="bg-gradient-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
