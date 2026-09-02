import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createHostedProxyApiKey,
  listHostedProxyApiKeys,
  revokeHostedProxyApiKey,
} from "../hosted-proxy-api-keys";

const queryKey = ["hosted-proxy-api-keys"];

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Nunca";
}

export function HostedProxyApiKeysPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const keys = useQuery({ queryKey, queryFn: listHostedProxyApiKeys });
  const create = useMutation({
    mutationFn: createHostedProxyApiKey,
    onSuccess: ({ key }) => {
      setCreatedKey(key);
      setName("");
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const revoke = useMutation({
    mutationFn: revokeHostedProxyApiKey,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Vercel + Supabase</p>
          <h1 className="text-2xl font-semibold tracking-tight">API keys do proxy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chaves válidas somente para Responses hospedado.</p>
        </div>
        <Button asChild variant="outline"><Link to="/dashboard">Voltar ao Dashboard</Link></Button>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => {
          event.preventDefault();
          setCreatedKey(null);
          create.mutate(name);
        }}>
          <Input aria-label="Nome da API key" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: notebook pessoal" />
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Criando…" : "Criar API key"}</Button>
        </form>
        {create.error ? <p role="alert" className="mt-3 text-sm text-destructive">Não foi possível criar a API key.</p> : null}
        {createdKey ? <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Copie agora. Esta chave não será mostrada novamente.</p>
          <code className="mt-2 block break-all rounded bg-background p-2 text-xs">{createdKey}</code>
        </div> : null}
      </section>

      <section aria-label="API keys hospedadas" className="space-y-3">
        {keys.isPending ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Carregando API keys…</p> : null}
        {keys.error ? <p role="alert" className="rounded-xl border border-destructive/50 bg-card p-4 text-sm text-destructive">Não foi possível carregar as API keys.</p> : null}
        {keys.data?.length === 0 ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nenhuma API key criada.</p> : null}
        {keys.data?.map((key) => <article key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="min-w-0"><h2 className="truncate font-medium">{key.name}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{key.key_prefix}…</p><p className="mt-1 text-xs text-muted-foreground">Último uso: {formatDate(key.last_used_at)}</p></div>
          {key.is_active ? <Button variant="destructive" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(key.id)}>Revogar</Button> : <span className="text-sm text-muted-foreground">Revogada</span>}
        </article>)}
      </section>
    </div>
  </main>;
}
