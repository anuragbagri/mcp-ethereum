import {ethers} from 'ethers';
import dotenv from 'dotenv'
dotenv.config();


const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "provide rpc url ");


export default provider;