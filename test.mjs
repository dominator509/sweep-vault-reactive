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
const bal = (provider, a) => provider.send('eth_getBalance', [a, 'latest']).then(BigInt);
test('repeated deposits: a second sweep only moves what is above the cap again', async () => {
  const { provider, owner, proxy, reactive, cold, vault } = await setup();
  const o = await owner.getAddress(), c = await cold.getAddress(), r = await reactive.getAddress();
  await (await vault.connect(owner).setRule(parseEther('1'), c)).wait();
  const before = await bal(provider, c);
  await (await vault.connect(owner).deposit(o, { value: parseEther('3') })).wait();
  await (await vault.connect(proxy).sweep(r, o)).wait();
  await (await vault.connect(owner).deposit(o, { value: parseEther('0.5') })).wait();
  await (await vault.connect(proxy).sweep(r, o)).wait();
  assert.equal(await vault.balanceOf(o), parseEther('1'));
  assert.equal((await bal(provider, c)) - before, parseEther('2.5'));
});
test('a repeated sweep with nothing above the cap is a no-op', async () => {
  const { owner, proxy, reactive, cold, vault } = await setup();
  const o = await owner.getAddress();
  await (await vault.connect(owner).setRule(parseEther('1'), await cold.getAddress())).wait();
  await (await vault.connect(owner).deposit(o, { value: parseEther('2') })).wait();
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), o)).wait();
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), o)).wait();
  assert.equal(await vault.balanceOf(o), parseEther('1'));
});
test('two owners keep separate balances and rules', async () => {
  const { owner, other, proxy, reactive, cold, vault } = await setup();
  const a = await owner.getAddress(), b = await other.getAddress(), c = await cold.getAddress();
  await (await vault.connect(owner).setRule(parseEther('1'), c)).wait();
  await (await vault.connect(other).setRule(parseEther('5'), c)).wait();
  await (await vault.connect(owner).deposit(a, { value: parseEther('2') })).wait();
  await (await vault.connect(other).deposit(b, { value: parseEther('2') })).wait();
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), a)).wait();
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), b)).wait();
  assert.equal(await vault.balanceOf(a), parseEther('1'));
  assert.equal(await vault.balanceOf(b), parseEther('2'));
});
test('no rule set means sweep does nothing', async () => {
  const { owner, proxy, reactive, vault } = await setup();
  const o = await owner.getAddress();
  await (await vault.connect(owner).deposit(o, { value: parseEther('2') })).wait();
  await (await vault.connect(proxy).sweep(await reactive.getAddress(), o)).wait();
  assert.equal(await vault.balanceOf(o), parseEther('2'));
});
test('cannot withdraw more than your balance, cannot set a zero cold address, cannot deposit zero', async () => {
  const { owner, vault } = await setup();
  const o = await owner.getAddress();
  await assert.rejects(vault.connect(owner).withdraw(1n));
  await assert.rejects(vault.connect(owner).setRule(1n, '0x0000000000000000000000000000000000000000'));
  await assert.rejects(vault.connect(owner).deposit(o, { value: 0n }));
});
test('a cold address that rejects ETH makes the sweep revert and leaves the balance intact', async () => {
  const { owner, proxy, reactive, vault, provider } = await setup();
  const o = await owner.getAddress();
  // tiny contract whose runtime code is just REVERT, so it rejects any ETH sent to it
  const dep = await owner.sendTransaction({ data: '0x6005600c60003960056000f360006000fd' });
  const rcpt = await dep.wait();
  await (await vault.connect(owner).setRule(parseEther('1'), rcpt.contractAddress)).wait();
  await (await vault.connect(owner).deposit(o, { value: parseEther('2') })).wait();
  await assert.rejects(vault.connect(proxy).sweep(await reactive.getAddress(), o));
  assert.equal(await vault.balanceOf(o), parseEther('2'));
});
test('a third party cannot redirect someone else\'s deposit by calling setRule (Hermes review #238, claimed HIGH)', async () => {
  const { provider, owner, other, proxy, reactive, cold, vault } = await setup();
  const victim = await owner.getAddress(), attacker = await other.getAddress(), c = await cold.getAddress(), r = await reactive.getAddress();
  // a third party deposits for the victim, who has no rule yet
  await (await vault.connect(other).deposit(victim, { value: parseEther('2') })).wait();
  // attacker front-runs with a rule that pays themselves: it only ever sets the attacker's own rule
  await (await vault.connect(other).setRule(0n, attacker)).wait();
  const [capV, coldV] = await vault.rules(victim);
  assert.equal(capV, 0n); assert.equal(coldV, '0x0000000000000000000000000000000000000000');
  const before = await bal(provider, attacker);
  await (await vault.connect(proxy).sweep(r, victim, { gasLimit: 500000 })).wait();
  assert.equal(await vault.balanceOf(victim), parseEther('2'));      // nothing moved
  assert.equal(await bal(provider, attacker), before);               // attacker got nothing
  // once the victim sets their own rule, the attacker's rule still does not apply to the victim
  await (await vault.connect(owner).setRule(parseEther('1'), c)).wait();
  await (await vault.connect(other).setRule(0n, attacker)).wait();
  const before2 = await bal(provider, c);
  await (await vault.connect(proxy).sweep(r, victim, { gasLimit: 500000 })).wait();
  assert.equal((await bal(provider, c)) - before2, parseEther('1'));
  assert.equal(await vault.balanceOf(victim), parseEther('1'));
});
test('invariant: sum of balances never exceeds the ETH held, across deposit, sweep and withdraw', async () => {
  const { provider, owner, other, proxy, reactive, cold, vault } = await setup();
  const a = await owner.getAddress(), b = await other.getAddress(), c = await cold.getAddress(), r = await reactive.getAddress(), v = await vault.getAddress();
  const check = async () => assert.ok((await vault.balanceOf(a)) + (await vault.balanceOf(b)) <= (await bal(provider, v)));
  await (await vault.connect(owner).setRule(parseEther('1'), c)).wait();
  await (await vault.connect(other).setRule(parseEther('0.5'), c)).wait();
  for (const [s, who, amt] of [[owner, a, '3'], [other, b, '2'], [owner, b, '0.25'], [other, a, '0.1']]) {
    await (await vault.connect(s).deposit(who, { value: parseEther(amt) })).wait(); await check();
    await (await vault.connect(proxy).sweep(r, a, { gasLimit: 500000 })).wait(); await check();
    await (await vault.connect(proxy).sweep(r, b, { gasLimit: 500000 })).wait(); await check();
  }
  await (await vault.connect(owner).withdraw(parseEther('0.5'))).wait(); await check();
});
