"use client";

import { useMe } from "@/hooks/useAuth";
import { FunnelDashboard } from "@/features/funnel/funnel-dashboard";

export default function FunnelPage() {
  const { data: user } = useMe();

  if (user && user.role !== "SALES") {
    return (
      <p className="text-sm text-muted-foreground">
        Sales Funnel Bot is available to Sales (Admin) only.
      </p>
    );
  }

  return <FunnelDashboard />;
}
