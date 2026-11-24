# Sweep Vault

Set it and forget it savings rule on Reactive Omni. You set a cap and a cold address. Whenever a deposit pushes your vault balance over the cap, a Reactive contract on Lasna sees the `Deposited` event and requests a callback that sweeps the excess to your cold address. No bot, no keeper.

Track: Set It and Forget It. License: Apache-2.0.

## How it works
- `contracts/SweepVault.sol` (Ethereum Sepolia): `setRule(cap, cold)`, `deposit(owner)`, `withdraw`, and `sweep` (callable only through the Reactive callback proxy, only for the trusted reactive contract).
- `contracts/SweepReactive.sol` (Lasna): subscribes to the vault's `Deposited` event and calls `requestCallbackV_1_0` with a `sweep` payload.
- The vault re-reads state in `sweep`, so stale or repeated callbacks are harmless.

## Live testnet run
See `deployment.json`.
- Vault (Eth Sepolia): 0x38D0b27386f8e69556137BE6D334C89f7dC6A5d6
- Reactive (Lasna): 0xfb1e3A95475ECD3575Bab5707669bf1A4DB21DE0
- setRule 0x15009bb0d715047e04b62908e419d403b62162e068702adaa36c1f29c9f95f34, deposit 0.004 ETH 0x7f0a383d589a14b19b977bcf7a06a1d5c770f9d76f3d81e370270929bb71679b
- Reactive callback sweep 0xa0db3792584189c5c5f919f233585b7e071e0e74310e77c7c0964cad27a342cd (0.003 ETH swept, about 6 s after the deposit)

## Run it
```
git clone https://github.com/Reactive-Network/reactive-lib-omni vendor/reactive-lib-omni
npm install && npm test   # 11 tests
```
Deploy: `node deploy.mjs` (vault, addresses precomputed from nonces), `node deploy-reactive.mjs <vault>`, then `node demo.mjs <vault> <cold>`. Wallet key is read from `~/.reactive/key`; use a throwaway testnet key only.

See `AUDIT.md` for what is tested, what is not, and where a reviewer should look first. License: Apache-2.0 (`LICENSE`).

## Known limits (demo scope)
- Testnet demo, not for real funds. Anyone can deposit for any owner, and every deposit triggers a paid callback, so spam costs the vault more than it costs the spammer. A real version needs a minimum deposit or an over-cap-only event.
- Callback fees come out of the vault's ETH balance, which also holds user deposits.
- The trusted callback sender is fixed at deploy. Verify what the proxy injects on a new chain first.
- Callback gas is fixed at 400,000. An owner who sets an expensive cold contract can stall only their own sweeps.
- See AUDIT.md for review findings.
