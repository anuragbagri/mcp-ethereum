import provider from "../utils/connection";


async function getLatestBlockNumber() {
    const latestBlockNumber = await provider.getBlockNumber();
    return latestBlockNumber;
}


export async function getBlock(blockNumber : number ){
   return await provider.getBlock(blockNumber);
}
