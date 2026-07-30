import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { runFunnelSync } from "@/lib/funnel/sync";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, "SALES");
    try {
      const result = await runFunnelSync();
      return ok(result);
    } catch (e: any) {
      return fail(e?.message || "Funnel sync failed", 503);
    }
  });
}
