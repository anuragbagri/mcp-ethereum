import provider from "../connection";

export async function getTransaction(txhash : string) {
  return await provider.getTransaction(txhash);
}