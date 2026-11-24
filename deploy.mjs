// Deploys SweepVault on Ethereum Sepolia and SweepReactive on Lasna. Addresses are precomputed
// from deployer nonces so the vault (needs reactive address) and reactive (needs vault) do not cycle.
import { readFileSync, writeFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet, ContractFactory, getCreateAddress, parseEther } from 'ethers';
const art = (n) => JSON.parse(readFileSync(`out/${n}.json`, 'utf8'));
const key = readFileSync(process.env.HOME + '/.reactive/key', 'utf8').trim();
const DEST = { id: 11155111n, rpc: 'https://ethereum-sepolia-rpc.publicnode.com', proxy: '0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4' };
const dp = new JsonRpcProvider(DEST.rpc), lp = new JsonRpcProvider('https://lasna-rpc.rnk.dev/');
const dw = new Wallet(key, dp), lw = new Wallet(key, lp);
const vaultAddr = getCreateAddress({ from: dw.address, nonce: await dp.getTransactionCount(dw.address) });
const reactAddr = getCreateAddress({ from: lw.address, nonce: await lp.getTransactionCount(lw.address) });
console.log('predicted vault', vaultAddr, 'reactive', reactAddr);
const v = art('SweepVault'), r = art('SweepReactive');
const vault = await new ContractFactory(v.abi, v.bytecode, dw).deploy(DEST.proxy, reactAddr, { value: parseEther('0.005') });
await vault.waitForDeployment(); console.log('vault', await vault.getAddress(), vault.deploymentTransaction().hash);
const react = await new ContractFactory(r.abi, r.bytecode, lw).deploy(DEST.id, vaultAddr, { value: parseEther('1') });
await react.waitForDeployment(); console.log('reactive', await react.getAddress(), react.deploymentTransaction().hash);
// Post-deploy wiring check: each contract must sit at the address the other one was told to trust.
if ((await vault.getAddress()) !== vaultAddr || (await react.getAddress()) !== reactAddr) throw new Error('deployed address differs from the predicted one: wiring is wrong, redeploy');
writeFileSync('deployment.json', JSON.stringify({ destChain: 'Ethereum Sepolia (11155111)', vault: vaultAddr, reactive_lasna: reactAddr, vaultDeployTx: vault.deploymentTransaction().hash, reactiveDeployTx: react.deploymentTransaction().hash }, null, 1));
