import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Activity } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

interface VitalsForm {
  heart_rate: string;
  systolic_bp: string;
  diastolic_bp: string;
  spo2: string;
  body_temp: string;
  steps: string;
  weight_kg: string;
  notes: string;
}

const empty: VitalsForm = {
  heart_rate: "", systolic_bp: "", diastolic_bp: "",
  spo2: "", body_temp: "", steps: "", weight_kg: "", notes: "",
};

const fields: { key: keyof VitalsForm; label: string; placeholder: string; unit: string; required?: boolean }[] = [
  { key: "heart_rate",    label: "Heart rate",       placeholder: "72",    unit: "bpm",  required: true },
  { key: "systolic_bp",   label: "Systolic BP",      placeholder: "120",   unit: "mmHg", required: true },
  { key: "diastolic_bp",  label: "Diastolic BP",     placeholder: "80",    unit: "mmHg", required: true },
  { key: "spo2",          label: "SpO₂",             placeholder: "98",    unit: "%",    required: true },
  { key: "body_temp",     label: "Body temperature", placeholder: "36.6",  unit: "°C",   required: true },
  { key: "steps",         label: "Steps today",      placeholder: "5000",  unit: "steps" },
  { key: "weight_kg",     label: "Weight",           placeholder: "70",    unit: "kg" },
];

export const LogVitalsModal = ({ open, onClose, onLogged }: Props) => {
  const session = getSession();
  const [form, setForm] = useState<VitalsForm>(empty);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof VitalsForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    const required = fields.filter(f => f.required);
    for (const f of required) {
      if (!form[f.key].trim()) return toast.error(`${f.label} is required`);
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("vitals").insert({
        patient_id:   session!.id,
        heart_rate:   parseInt(form.heart_rate),
        systolic_bp:  parseInt(form.systolic_bp),
        diastolic_bp: parseInt(form.diastolic_bp),
        spo2:         parseFloat(form.spo2),
        body_temp:    parseFloat(form.body_temp),
        steps:        form.steps ? parseInt(form.steps) : null,
        weight_kg:    form.weight_kg ? parseFloat(form.weight_kg) : null,
        notes:        form.notes.trim() || null,
        recorded_at:  new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Vitals logged successfully");
      onLogged?.();
      onClose();
      setForm(empty);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to log vitals");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Log vitals
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-xs font-semibold">
                {f.label} <span className="font-normal text-muted-foreground">({f.unit})</span>
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={f.key}
                type="number"
                step="any"
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="notes"
              placeholder="e.g. After morning walk"
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save vitals"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
