import { ethers } from "ethers";
import provider from "../connection";

export async function searchEvents(contractAddress : string, abi : any, eventName : string , fromBlock : number , toBlock : number) {
   const Contract = new ethers.Contract(contractAddress, abi ,provider);
   const events = await Contract.queryFilter(Contract.filters[eventName]() , fromBlock , toBlock)

   return events
      .filter((e): e is ethers.EventLog => 'args' in e)
      .map(e => e.args);
}