import { redactIdentifier } from "./debug";
import { requestGateway } from "./gateway-core";
import type {
  MagicBlockPrivateSendRequest,
  MagicBlockSubmittedPrivateTransfer,
  MagicBlockUnsignedPrivateTransfer,
  WebApiEnvelope,
} from "./types";

export async function requestGatewayMagicBlockPrivateSend(
  gatewayOrigin: string,
  input: MagicBlockPrivateSendRequest & { sessionToken?: string },
): Promise<
  WebApiEnvelope<MagicBlockUnsignedPrivateTransfer | MagicBlockSubmittedPrivateTransfer>
> {
  const headers = new Headers({
    "content-type": "application/json",
  });
  const { sessionToken, ...body } = input;

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return requestGateway<MagicBlockUnsignedPrivateTransfer | MagicBlockSubmittedPrivateTransfer>({
    gatewayOrigin,
    label: `private_send.magicblock.${input.action}`,
    path: "/web/payment/private-send",
    init: {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    },
    context: {
      action: input.action,
      mint: input.action === "prepare" ? input.mint : undefined,
      provider: input.provider,
      recipient:
        input.action === "prepare" ? redactIdentifier(input.recipient) : undefined,
    },
  });
}
