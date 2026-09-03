import { useEffect, useState, type FormEvent, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthGate } from "@/features/auth/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseUsageMonitorClient, isSupabaseUsageMonitorEnabled } from "@/features/gemini-usage/supabase-usage-monitor";

type AccessStatus = "idle" | "loading" | "recovery-sent" | "error";
type AccessView = "login" | "recovery" | "update-password";

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
    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY" && nextSession) setView("update-password");
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

  const requestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    const { error } = await getSupabaseUsageMonitorClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/usage-monitor`,
    });
    setStatus(error ? "error" : "recovery-sent");
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    const { error } = await getSupabaseUsageMonitorClient().auth.updateUser({ password });
    if (error) {
      setStatus("error");
      return;
    }
    setPassword("");
    setView("login");
    setStatus("idle");
  };

  if (session && view !== "update-password") return <>{children}</>;

  if (view === "update-password") {
    return <AccessCard>
      <form className="space-y-4" onSubmit={(event) => void updatePassword(event)}>
        <div><h1 className="text-lg font-semibold tracking-tight">Defina sua senha</h1><p className="mt-1 text-sm text-zinc-400">Use esta senha nos próximos acessos ao painel.</p></div>
        <Input aria-label="Nova senha" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={status === "loading"} />
        <Button className="w-full" type="submit" disabled={status === "loading"}>{status === "loading" ? "Salvando…" : "Salvar senha"}</Button>
        {status === "error" ? <p role="alert" className="text-sm text-destructive">Não foi possível salvar a senha. Tente novamente.</p> : null}
      </form>
    </AccessCard>;
  }

  if (view === "recovery") {
    return <AccessCard>
      <form className="space-y-4" onSubmit={(event) => void requestPasswordReset(event)}>
        <div><h1 className="text-lg font-semibold tracking-tight">Recuperar acesso</h1><p className="mt-1 text-sm text-zinc-400">Enviaremos um link para você definir uma senha.</p></div>
        <Input aria-label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "loading"} />
        <Button className="w-full" type="submit" disabled={status === "loading"}>{status === "loading" ? "Enviando…" : "Enviar link para definir senha"}</Button>
        <Button className="w-full" type="button" variant="ghost" onClick={() => { setStatus("idle"); setView("login"); }}>Voltar ao login</Button>
        {status === "recovery-sent" ? <p className="text-sm text-emerald-400">Verifique seu e-mail e defina uma senha neste dispositivo.</p> : null}
        {status === "error" ? <p role="alert" className="text-sm text-destructive">Não foi possível enviar o link. Tente novamente.</p> : null}
      </form>
    </AccessCard>;
  }

  return <AccessCard>
    <form className="space-y-4" onSubmit={(event) => void signIn(event)}>
      <div><h1 className="text-lg font-semibold tracking-tight">Usage Monitor</h1><p className="mt-1 text-sm text-zinc-400">Entre com seu e-mail e senha para abrir o painel.</p></div>
      <Input aria-label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "loading"} />
      <Input aria-label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={status === "loading"} />
      <Button className="w-full" type="submit" disabled={status === "loading"}>{status === "loading" ? "Entrando…" : "Entrar"}</Button>
      <Button className="w-full" type="button" variant="ghost" onClick={() => { setStatus("idle"); setView("recovery"); }}>Definir ou recuperar senha</Button>
      {status === "error" ? <p role="alert" className="text-sm text-destructive">E-mail ou senha inválidos. Tente novamente.</p> : null}
    </form>
  </AccessCard>;
}

export function UsageMonitorAccessGate({ children }: PropsWithChildren) {
  return isSupabaseUsageMonitorEnabled() ? <SupabaseUsageMonitorAccessGate>{children}</SupabaseUsageMonitorAccessGate> : <AuthGate>{children}</AuthGate>;
}
