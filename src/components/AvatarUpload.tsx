import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSession, setSession, getSessionAsync } from "@/lib/auth";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  avatarUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onUpdated?: (url: string) => void;
}

const sizeMap = {
  sm: { outer: "h-9 w-9",  text: "text-xs",  icon: "h-3 w-3",  badge: "h-4 w-4 -bottom-0.5 -right-0.5" },
  md: { outer: "h-12 w-12", text: "text-sm",  icon: "h-3.5 w-3.5", badge: "h-5 w-5 -bottom-0.5 -right-0.5" },
  lg: { outer: "h-20 w-20", text: "text-lg",  icon: "h-4 w-4",  badge: "h-6 w-6 -bottom-1 -right-1" },
};

export const Avatar = ({ avatarUrl, name, size = "md", editable = false, onUpdated }: Props) => {
  const session   = getSession();
  const fileRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState<string | null>(avatarUrl);
  const s = sizeMap[size];

  const initials = name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }

    setUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `${session.id}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", session.id);
      if (updateErr) throw updateErr;

      // Update in-memory session cache
      const fresh = await getSessionAsync();
      if (fresh) setSession(fresh);

      setPreview(publicUrl);
      onUpdated?.(urlData.publicUrl);
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className={`relative shrink-0 ${editable ? "cursor-pointer group" : ""}`}
      onClick={() => editable && fileRef.current?.click()}>
      <div className={`${s.outer} rounded-full overflow-hidden bg-gradient-primary flex items-center justify-center ${s.text} font-bold text-primary-foreground`}>
        {uploading ? (
          <Loader2 className={`${s.icon} animate-spin text-primary-foreground`} />
        ) : preview ? (
          <img src={preview} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {editable && !uploading && (
        <div className={`absolute ${s.badge} flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft opacity-0 group-hover:opacity-100 transition-opacity`}>
          <Camera className={s.icon} />
        </div>
      )}

      {editable && (
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handlePick} />
      )}
    </div>
  );
};
