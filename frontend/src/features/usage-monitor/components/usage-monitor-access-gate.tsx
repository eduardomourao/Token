import { useEffect, useState, type FormEvent, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthGate } from "@/features/auth/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseUsageMonitorClient, isSupabaseUsageMonitorEnabled } from "@/features/gemini-usage/supabase-usage-monitor";

type AccessStatus = "idle" | "loading" | "error";
type AccessView = "login" | "sign-up";

function AccessCard({ children }: PropsWithChildren) {
  return <main className="flex min-h-dvh items-center justify-center bg-[#09090b] p-4 text-zinc-100">
    <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5">{children}</div>
  </main>;
}

function SupabaseUsageMonitorAccessGate({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<AccessView>("login");
  const [status, setStatus] = useState<AccessStatus>("idle");

  useEffect(() => {
    const client = getSupabaseUsageMonitorClient();
    let mounted = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(data.session);
      setStatus(error ? "error" : "idle");
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    const { data, error } = await getSupabaseUsageMonitorClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      setStatus("error");
      return;
    }
    setPassword("");
    setSession(data.session);
    setStatus("idle");
  };

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    const { data, error } = await getSupabaseUsageMonitorClient().auth.signUp({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      setStatus("error");
      return;
    }
    setPassword("");
    setSession(data.session);
    setStatus("idle");
  };

  if (session) return <>{children}</>;

  if (view === "sign-up") {
    return <AccessCard>
      <form className="space-y-4" onSubmit={(event) => void signUp(event)}>
        <div><h1 className="text-lg font-semibold tracking-tight">Criar conta</h1><p className="mt-1 text-sm text-zinc-400">Cadastre seu e-mail e senha para acessar o painel imediatamente.</p></div>
        <Input aria-label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "loading"} />
        <Input aria-label="Senha" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={status === "loading"} />
        <Button className="w-full" type="submit" disabled={status === "loading"}>{status === "loading" ? "Criando…" : "Criar conta"}</Button>
        <Button className="w-full" type="button" variant="ghost" onClick={() => { setPassword(""); setStatus("idle"); setView("login"); }}>Já tenho uma conta</Button>
        {status === "error" ? <p role="alert" className="text-sm text-destructive">Não foi possível criar esta conta. Tente outro e-mail ou entre com a senha existente.</p> : null}
      </form>
    </AccessCard>;
  }

  return <AccessCard>
    <form className="space-y-4" onSubmit={(event) => void signIn(event)}>
      <div><h1 className="text-lg font-semibold tracking-tight">Usage Monitor</h1><p className="mt-1 text-sm text-zinc-400">Entre com seu e-mail e senha para abrir o painel.</p></div>
      <Input aria-label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "loading"} />
      <Input aria-label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={status === "loading"} />
      <Button className="w-full" type="submit" disabled={status === "loading"}>{status === "loading" ? "Entrando…" : "Entrar"}</Button>
      <Button className="w-full" type="button" variant="ghost" onClick={() => { setPassword(""); setStatus("idle"); setView("sign-up"); }}>Criar conta</Button>
      {status === "error" ? <p role="alert" className="text-sm text-destructive">E-mail ou senha inválidos. Tente novamente.</p> : null}
    </form>
  </AccessCard>;
}

export function UsageMonitorAccessGate({ children }: PropsWithChildren) {
  return isSupabaseUsageMonitorEnabled() ? <SupabaseUsageMonitorAccessGate>{children}</SupabaseUsageMonitorAccessGate> : <AuthGate>{children}</AuthGate>;
}
