// Live demo on Ethereum Sepolia: set a cap, deposit above it, wait for the Reactive callback sweep.
import { readFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from 'ethers';
const VAULT = process.argv[2], COLD = process.argv[3];
const abi = JSON.parse(readFileSync('out/SweepVault.json', 'utf8')).abi;
const p = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
const w = new Wallet(readFileSync(process.env.KEY_FILE || process.env.HOME + '/.reactive/key', 'utf8').trim(), p);
const v = new Contract(VAULT, abi, w);
const t1 = await v.setRule(parseEther(process.env.CAP || '0.001'), COLD); await t1.wait(); console.log('setRule', t1.hash);
const t2 = await v.deposit(w.address, { value: parseEther(process.env.DEPOSIT || '0.004') }); await t2.wait(); console.log('deposit', t2.hash);
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 6000));
  const logs = await v.queryFilter(v.filters.Swept(), -2000);
  if (logs.length) { for (const l of logs) console.log('Swept tx', l.transactionHash, formatEther(l.args.amount), 'to', l.args.cold); break; }
  console.log('waiting', i);
}
console.log('balanceOf', formatEther(await v.balanceOf(w.address)), 'cold', formatEther(await p.getBalance(COLD)));
