// Second half of the deploy: SweepReactive on Lasna at the address the vault was told to trust.
import { readFileSync, writeFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet, ContractFactory, getCreateAddress, parseEther } from 'ethers';
const vault = process.argv[2];
const r = JSON.parse(readFileSync('out/SweepReactive.json', 'utf8'));
const lp = new JsonRpcProvider('https://lasna-rpc.rnk.dev/');
const lw = new Wallet(readFileSync(process.env.HOME + '/.reactive/key', 'utf8').trim(), lp);
console.log('will deploy at', getCreateAddress({ from: lw.address, nonce: await lp.getTransactionCount(lw.address) }));
const fee = await lp.getFeeData();
const react = await new ContractFactory(r.abi, r.bytecode, lw).deploy(11155111n, vault, { value: parseEther('1'), maxPriorityFeePerGas: 1n, maxFeePerGas: (fee.maxFeePerGas ?? 10n ** 9n) + 10n });
await react.waitForDeployment(); console.log('reactive', await react.getAddress(), react.deploymentTransaction().hash);
