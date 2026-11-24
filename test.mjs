import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, Contract, parseEther } from 'ethers';
const art = (n) => JSON.parse(readFileSync(`out/${n}.json`, 'utf8'));
async function setup() {
  const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, wallet: { totalAccounts: 6, defaultBalance: 1000 } }));
  const [owner, proxy, reactive, cold, other] = await Promise.all([0, 1, 2, 3, 4].map((i) => provider.getSigner(i)));
  const v = art('SweepVault');
  const vault = await new ContractFactory(v.abi, v.bytecode, owner).deploy(await proxy.getAddress(), await reactive.getAddress());
  await vault.waitForDeployment();
  return { provider, owner, proxy, reactive, cold, other, vault };
}
test('deposit above cap then sweep moves the excess to the cold address', async () => {
  const { provider, owner, proxy, reactive, cold, vault } = await setup();
  await (await vault.connect(owner).setRule(parseEther('1'), await cold.getAddress())).wait();
  await (await vault.connect(owner).deposit(await owner.getAddress(), { value: parseEther('3') })).wait();
  provider.pollingInterval = 10; const before = BigInt(await provider.send('eth_getBalance', [await cold.getAddress(), 'latest'])); await new Promise((r) => setTimeout(r, 50));
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), await owner.getAddress())).wait();
  assert.equal(await vault.balanceOf(await owner.getAddress()), parseEther('1'));
  assert.equal(BigInt(await provider.send('eth_getBalance', [await cold.getAddress(), 'latest'])) - before, parseEther('2'));
});
test('sweep below cap does nothing', async () => {
  const { proxy, reactive, owner, cold, vault } = await setup();
  await (await vault.connect(owner).setRule(parseEther('5'), await cold.getAddress())).wait();
  await (await vault.connect(owner).deposit(await owner.getAddress(), { value: parseEther('1') })).wait();
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), await owner.getAddress())).wait();
  assert.equal(await vault.balanceOf(await owner.getAddress()), parseEther('1'));
});
test('only the callback proxy can sweep', async () => {
  const { other, reactive, owner, vault } = await setup();
  await assert.rejects(vault.connect(other).sweep(await reactive.getAddress(), await owner.getAddress()));
});
test('proxy cannot sweep with a wrong reactive sender', async () => {
  const { proxy, other, owner, vault } = await setup();
  await assert.rejects(vault.connect(proxy).sweep(await other.getAddress(), await owner.getAddress()));
});
test('owner can withdraw their own balance', async () => {
  const { owner, vault } = await setup();
  await (await vault.connect(owner).deposit(await owner.getAddress(), { value: parseEther('2') })).wait();
  await (await vault.connect(owner).withdraw(parseEther('2'))).wait();
  assert.equal(await vault.balanceOf(await owner.getAddress()), 0n);
});
