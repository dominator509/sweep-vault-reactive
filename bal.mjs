import {JsonRpcProvider,formatEther} from 'ethers';
const a='0x5e22ba097291b9027eC5952ab9180d8f3f576c40';
const s=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com'),l=new JsonRpcProvider('https://lasna-rpc.rnk.dev/');
console.log('sep',formatEther(await s.getBalance(a)),'lasna',formatEther(await l.getBalance(a)),await l.getTransactionCount(a,'latest'),await l.getTransactionCount(a,'pending'));
