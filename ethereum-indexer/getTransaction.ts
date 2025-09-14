import provider from "../utils/connection";

export async function getTransaction(txhash : string) {
  return await provider.getTransaction(txhash);
}