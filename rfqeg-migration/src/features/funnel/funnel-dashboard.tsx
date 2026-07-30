"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  RefreshCw,
  Mail,
  Columns3,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { FunnelRulesPanel } from "./rules-panel";

type FunnelStatus = {
  sheetsConfigured: boolean;
  emailConfigured: boolean;
  geminiConfigured: boolean;
  sheetUrl: string;
  serviceAccountEmail: string | null;
  emailUser: string;
};

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  );
}

export function FunnelDashboard() {
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ["funnel-status"],
    queryFn: () => api.get<FunnelStatus>("/api/funnel/status"),
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: "sync" | "setup-columns" | "reapply") {
    setBusy(action);
    setMsg(null);
    try {
      const path =
        action === "sync"
          ? "/api/funnel/sync"
          : action === "setup-columns"
            ? "/api/funnel/setup-columns"
            : "/api/funnel/reapply";
      const r = await api.post<{ message: string }>(path);
      setMsg(r.message);
      qc.invalidateQueries({ queryKey: ["funnel-status"] });
    } catch (e: any) {
      setMsg(e.message || "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const ready =
    status?.sheetsConfigured && status?.emailConfigured && status?.geminiConfigured;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Funnel Bot</h1>
          <p className="text-sm text-muted-foreground">
            Contained Expo module — unread Gmail quotes → Gemini → Google Sheets (31 columns).
            Separate from RFQ &quot;Update From Email&quot;.
          </p>
        </div>
        {status?.sheetUrl && (
          <Button variant="outline" asChild>
            <a href={status.sheetUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Open Sheet
            </a>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Connection status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <StatusDot ok={!!status?.sheetsConfigured} />
                <span>Google Sheets</span>
                {status?.serviceAccountEmail && (
                  <Badge variant="secondary" className="max-w-[12rem] truncate text-[10px]">
                    {status.serviceAccountEmail}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <StatusDot ok={!!status?.emailConfigured} />
                <span>Inbox ({status?.emailUser || "—"})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <StatusDot ok={!!status?.geminiConfigured} />
                <span>Gemini</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("sync")} disabled={!!busy || !ready}>
          {busy === "sync" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Sync unread emails
        </Button>
        <Button variant="outline" onClick={() => run("setup-columns")} disabled={!!busy || !status?.sheetsConfigured}>
          {busy === "setup-columns" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Columns3 className="h-4 w-4" />
          )}
          Setup 31 columns
        </Button>
        <Button variant="outline" onClick={() => run("reapply")} disabled={!!busy || !status?.sheetsConfigured}>
          {busy === "reapply" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Reapply rules &amp; sort
        </Button>
      </div>

      {msg && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{msg}</p>
      )}

      <FunnelRulesPanel />
    </div>
  );
}
