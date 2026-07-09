import { PageHeader } from "@/components/offpay/page-header";
import { PrivateSendFlow } from "@/components/send/private-send-flow";

export default function SendPage() {
  return (
    <>
      <PageHeader
        title="Private Transfer"
        description="Configure and review your transfer."
      />

      <PrivateSendFlow />
    </>
  );
}
