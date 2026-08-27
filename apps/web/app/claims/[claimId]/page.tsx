import { SiteHeader } from "@/components/site-header";

import { ClaimReceipt } from "./claim-receipt";

export default async function ClaimPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  return <><SiteHeader /><ClaimReceipt claimId={claimId} /></>;
}
