import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Mail, Check } from "lucide-react";

interface PhysicalLetterRow {
  id: string;
  user_id: string;
  user_email: string;
  sender_name: string;
  recipient_name: string;
  recipient_address: string;
  plaintext_title: string;
  plaintext_body: string;
  plaintext_signature: string;
  posting_date: string;
  delivery_date: string;
  payment_status: string;
  fulfillment_status: string;
  admin_notes: string | null;
  posted_at: string | null;
}

const AdminPhysicalLetters = () => {
  const { user, isLoading: loading } = useAuth();
  const [rows, setRows] = useState<PhysicalLetterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"queued" | "posted" | "all">("queued");
  const [forbidden, setForbidden] = useState(false);

  const load = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-physical-letters?action=list", {
      method: "GET",
    });
    if (error) {
      if ((error as any).context?.status === 403) setForbidden(true);
      toast.error("Failed to load: " + error.message);
    } else {
      setRows(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const markPosted = async (id: string) => {
    const { error } = await supabase.functions.invoke("admin-physical-letters", {
      method: "POST",
      body: { action: "mark-posted", id },
    });
    if (error) return toast.error(error.message);
    toast.success("Marked as posted");
    load();
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.functions.invoke("admin-physical-letters", {
      method: "POST",
      body: { action: "set-notes", id, notes },
    });
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
  };

  const filtered = rows.filter((r) => {
    if (r.payment_status !== "paid") return false;
    if (filter === "all") return true;
    return r.fulfillment_status === filter;
  });

  if (forbidden) {
    return (
      <div className="container max-w-2xl mx-auto py-16">
        <p className="text-center text-muted-foreground">Forbidden — admin access only.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-editorial text-3xl">Physical Letters</h1>
        <div className="flex gap-2">
          {(["queued", "posted", "all"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">Nothing to show.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {row.recipient_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Post by <strong>{format(new Date(row.posting_date), "MMM d, yyyy")}</strong> · Delivery {format(new Date(row.delivery_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={row.fulfillment_status === "posted" ? "secondary" : "default"}>
                    {row.fulfillment_status}
                  </Badge>
                  {row.fulfillment_status !== "posted" && (
                    <Button size="sm" onClick={() => markPosted(row.id)}>
                      <Check className="w-4 h-4 mr-1" /> Mark posted
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">From</p>
                    <p className="font-medium">{row.sender_name}</p>
                    <p className="text-xs text-muted-foreground">{row.user_email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Address</p>
                    <pre className="whitespace-pre-wrap font-body text-sm">{row.recipient_address}</pre>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-muted-foreground text-xs mb-1">Title</p>
                  <p className="font-editorial text-lg mb-3">{row.plaintext_title}</p>
                  <p className="text-muted-foreground text-xs mb-1">Letter</p>
                  <pre className="whitespace-pre-wrap font-body text-sm bg-muted/40 p-4 rounded-lg">{row.plaintext_body}</pre>
                  <p className="mt-3 text-right italic">— {row.plaintext_signature}</p>
                </div>
                <details>
                  <summary className="text-sm cursor-pointer text-muted-foreground">Admin notes</summary>
                  <Textarea
                    defaultValue={row.admin_notes ?? ""}
                    placeholder="Internal notes…"
                    className="mt-2"
                    onBlur={(e) => {
                      if (e.target.value !== (row.admin_notes ?? "")) saveNotes(row.id, e.target.value);
                    }}
                  />
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPhysicalLetters;
