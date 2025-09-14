import provider from "../utils/connection";

export async function getLogs(address : string , fromBlock : number , toBlock : number , topics? :string[]) {
    return await provider.getLogs({address , fromBlock , toBlock , topics});
}