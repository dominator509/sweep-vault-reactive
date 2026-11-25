import {JsonRpcProvider,Contract,formatEther} from 'ethers';
import {readFileSync} from 'node:fs';
const p=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
const v=new Contract('0x447bffDe3A4d0f380Ee168593D25e81A95AB7314',JSON.parse(readFileSync('out/SweepVault.json','utf8')).abi,p);
for(const l of await v.queryFilter(v.filters.Swept(),-3000))console.log(l.transactionHash,formatEther(l.args.amount),l.args.cold);
console.log('cold2',formatEther(await p.getBalance('0x42EFC37179EB01ee5a2F42027f5465DD6C0D2163')));
