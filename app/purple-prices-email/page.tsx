import {
  getPurplePricesData,
} from "../../lib/purple-prices-data";
import { WorkflowTabs } from "./workflow-tabs";

export const dynamic = "force-dynamic";

export default async function PurplePricesEmailPage() {
  const data = await getPurplePricesData();
  const draftCampaign = data.currentDraftCampaign;
  const campaign = draftCampaign;

  return (
    <main className="email-module-shell">
      <WorkflowTabs
        campaigns={data.campaigns}
        currentCampaign={campaign}
        draft={data.draft}
        latestCampaign={data.latestCampaign}
        recentFailures={data.recentFailures}
        recentLog={data.recentLog}
        suppressions={data.suppressions}
        templates={data.templates}
      />
    </main>
  );
}
