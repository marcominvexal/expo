import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { getFunnelStatus } from "@/lib/funnel/sync";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, "SALES");
    return ok(getFunnelStatus());
  });
}
