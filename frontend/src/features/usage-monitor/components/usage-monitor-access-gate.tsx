import { useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthGate } from "@/features/auth/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseUsageMonitorClient, isSupabaseUsageMonitorEnabled } from "@/features/gemini-usage/supabase-usage-monitor";

function SupabaseUsageMonitorAccessGate({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const client = getSupabaseUsageMonitorClient();
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (session) return <>{children}</>;

  return <main className="flex min-h-dvh items-center justify-center bg-[#09090b] p-4 text-zinc-100">
    <form className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5" onSubmit={(event) => {
      event.preventDefault();
      setStatus("sending");
      void getSupabaseUsageMonitorClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/usage-monitor` },
      }).then(({ error }) => setStatus(error ? "error" : "sent"));
    }}>
      <div><h1 className="text-lg font-semibold tracking-tight">Usage Monitor</h1><p className="mt-1 text-sm text-zinc-400">Entre com seu e-mail para abrir o painel.</p></div>
      <Input aria-label="E-mail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "sending"} />
      <Button className="w-full" type="submit" disabled={status === "sending"}>{status === "sending" ? "Enviando…" : "Enviar link de acesso"}</Button>
      {status === "sent" ? <p className="text-sm text-emerald-400">Link enviado. Abra o e-mail neste dispositivo.</p> : null}
      {status === "error" ? <p role="alert" className="text-sm text-destructive">Não foi possível enviar o link. Tente novamente.</p> : null}
    </form>
  </main>;
}

export function UsageMonitorAccessGate({ children }: PropsWithChildren) {
  return isSupabaseUsageMonitorEnabled() ? <SupabaseUsageMonitorAccessGate>{children}</SupabaseUsageMonitorAccessGate> : <AuthGate>{children}</AuthGate>;
}
