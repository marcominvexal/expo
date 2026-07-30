"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FunnelRulesPanel() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          How each column is filled — Extraction &amp; Automation Rules
        </CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm text-muted-foreground">
        <p>
          Every row in the funnel sheet is built from these rules. Gemini extracts raw data from the
          email; then the bot cleans and validates each field before writing it to the sheet.
        </p>

        <Rule title="Quote ID">
          Only Exponentia internal IDs like <strong>I835-26</strong> or <strong>F780-23</strong> are
          accepted. Body only (never subject). Looks near &quot;Add and archive&quot; or a &quot;Quote
          ID:&quot; label. Partner refs (QTE-…, PID/BID/SP) are rejected.
        </Rule>

        <Rule title="Opportunity Date">
          When work actually started — not the first email. Older unrelated scope is ignored; wait-on-customer idle days are excluded.
        </Rule>

        <Rule title="Proposal Date">
          When our team sent the final pricing response. Falls back to Opportunity Date if none yet.
        </Rule>

        <Rule title="Partner Name">
          External company requesting the quote — never &quot;Exponentia Global.&quot; Falls back to sender domain.
        </Rule>

        <Rule title="End Customer">Final client org. Defaults to <strong>Unknown</strong>.</Rule>

        <Rule title="Site B / Site B City">
          Forced to <strong>-</strong> for Internet / DIA / BIA.
        </Rule>

        <Rule title="Technology">
          DIA/BIA → Internet · L2VPN/MPLS/EVPL → Ethernet · IPLC/IEPL/EoSDH/DPLC/DEPL → TDM ·
          Colocation+PWR → Datacenter · Cross Connects/Equipment/Field Support → Managed Services /
          Hardware.
        </Rule>

        <Rule title="Contract Term">
          Always in months (e.g. 12 Months). Multiple terms produce separate rows.
        </Rule>

        <Rule title="Status / Sub-status">New rows are always <strong>OPEN</strong> / <strong>MEDIUM</strong>.</Rule>

        <Rule title="TAT">
          Business days between Opportunity and Proposal — excluding weekends and Pakistan public
          holidays (<code>holidays.json</code>).
        </Rule>

        <Rule title="LM Infra Details">Exactly <strong>Fiber</strong> or <strong>Wireless</strong>. Default Fiber.</Rule>

        <Rule title="Protection / XC">
          Last mile &amp; wet segment: Protected / Unprotected / N/A. XC: Included / Excluded / N/A;
          Internet → always -.
        </Rule>

        <Rule title="Holidays">
          Count of Pakistan weekday public holidays in the Opportunity → Proposal range.
        </Rule>

        <Rule title="Offered Us">New Service / Renewal / Upgrade. Default: New Service.</Rule>
      </CardContent>
    </Card>
  );
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-foreground">{title}</h3>
      <p className="m-0 leading-relaxed">{children}</p>
    </div>
  );
}
