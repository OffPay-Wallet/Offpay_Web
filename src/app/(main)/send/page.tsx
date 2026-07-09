import { PageHeader } from "@/components/offpay/page-header";
import { PrivateSendFlow } from "@/components/send/private-send-flow";

export default function SendPage() {
  return (
    <>
      <PageHeader
        eyebrow="Send"
        title="Private payment"
        description="Choose MagicBlock or Umbra before wallet signing."
      />

      <PrivateSendFlow />
    </>
  );
}
