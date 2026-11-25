// Request lREACT on Lasna by sending Sepolia ETH to the official Reactive faucet contract.
import { readFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet, Contract, parseEther } from 'ethers';
const FAUCET = '0x9b9BB25f1A81078C544C829c5EB7822d747Cf434';
const value = process.argv[2] || '0.02';
const p = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
const w = new Wallet(readFileSync(process.env.KEY_FILE || process.env.HOME + '/.reactive/key', 'utf8').trim(), p);
const c = new Contract(FAUCET, ['function request(address) payable'], w);
const gas = await c.request.estimateGas(w.address, { value: parseEther(value) });
console.log('estimateGas ok', gas.toString());
if (process.env.SEND === '1') { const tx = await c.request(w.address, { value: parseEther(value) }); console.log('tx', tx.hash); await tx.wait(); console.log('mined'); }
