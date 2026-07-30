import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { setupFunnelColumns } from "@/lib/funnel/sync";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, "SALES");
    try {
      const result = await setupFunnelColumns();
      return ok(result);
    } catch (e: any) {
      return fail(e?.message || "Setup columns failed", 503);
    }
  });
}
