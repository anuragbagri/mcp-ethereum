import { getProvider, withProviderRetry } from "../utils/connection.js";

export type GetTransactionResult =
  | {
      found: true;
      transaction: {
        hash: string;
        from: string;
        to: string | null;
        value: string;
        blockNumber: number | null;
        nonce: number;
      };
    }
  | {
      found: false;
      reason: "not_found";
      txHash: string;
    };

export async function getTransaction(txHash: string): Promise<GetTransactionResult> {
  const tx = await withProviderRetry("getTransaction", async () => getProvider().getTransaction(txHash));

  if (!tx) {
    return {
      found: false,
      reason: "not_found",
      txHash,
    };
  }

  return {
    found: true,
    transaction: {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      blockNumber: tx.blockNumber,
      nonce: tx.nonce,
    },
  };
}
