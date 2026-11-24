# Sweep Vault

Set it and forget it savings rule on Reactive Omni. You set a cap and a cold address. Whenever a deposit pushes your vault balance over the cap, a Reactive contract on Lasna sees the `Deposited` event and requests a callback that sweeps the excess to your cold address. No bot, no keeper.

Track: Set It and Forget It. License: Apache-2.0.

## How it works
- `contracts/SweepVault.sol` (Ethereum Sepolia): `setRule(cap, cold)`, `deposit(owner)`, `withdraw`, and `sweep` (callable only through the Reactive callback proxy, only for the trusted reactive contract).
- `contracts/SweepReactive.sol` (Lasna): subscribes to the vault's `Deposited` event and calls `requestCallbackV_1_0` with a `sweep` payload.
- The vault re-reads state in `sweep`, so stale or repeated callbacks are harmless.

## Live testnet run
Current deployment (the build with the review fixes). See `deployment.json`.
- Vault (Eth Sepolia): 0x7a92362aF9Be18b34a8676904D5eA251FA560cCF
- Reactive (Lasna): 0xCEdf0e9789f28C07F0cF47c1b40E59f227e2C982
- setRule (cap 0.0002 ETH) 0xe0b7b08595f6088d54dc7e7fa2a960f8c52d9551bc91e786d24fb560098b5fb5, deposit 0x0fda9365fc82ac1af7b19543880c9edc2169d3238215053c4222730012f229a9
- Reactive callback sweep 0x130fa7f6a00c3a6d7a54725362d239c85a888321e59bc3f1581b10b3024228cf (0.0004 ETH swept to the cold address, about 30 s after the deposit)

First build (before the review fixes), also live: vault 0x38D0b27386f8e69556137BE6D334C89f7dC6A5d6, reactive 0xfb1e3A95475ECD3575Bab5707669bf1A4DB21DE0, sweep 0xa0db3792584189c5c5f919f233585b7e071e0e74310e77c7c0964cad27a342cd.

Cold address note: the callback gets a fixed 400,000 gas budget and the proxy keeps about 200,000 of it for itself. A first-ever sweep to a brand-new address that has never held ETH needed more gas than that on Sepolia (estimate about 246,000) and the proxy logged a `CallbackFailure`. A cold address that already exists on chain (a normal wallet that has held ETH) sweeps fine. Raise `CALLBACK_GAS` in `SweepReactive` before using fresh cold addresses.

## Run it
```
git clone https://github.com/Reactive-Network/reactive-lib-omni vendor/reactive-lib-omni
npm install && npm test   # 11 tests
```
Deploy: `node deploy.mjs` (vault, addresses precomputed from nonces), `node deploy-reactive.mjs <vault>`, then `node demo.mjs <vault> <cold>`. Wallet key is read from `~/.reactive/key`; use a throwaway testnet key only.

See `AUDIT.md` for what is tested, what is not, and where a reviewer should look first. License: Apache-2.0 (`LICENSE`).

## Known limits (demo scope)
- Testnet demo, not for real funds. Anyone can deposit for any owner, and every deposit triggers a paid callback, so spam costs the float more than it costs the spammer. A real version needs a minimum deposit or an over-cap-only event.
- Callback fees are paid from a separate fee float (ETH above the sum of user credits). Spam can drain the float and stop sweeps, but cannot touch deposits.
- The trusted callback sender is fixed at deploy. Verify what the proxy injects on a new chain first.
- Callback gas is fixed at 400,000. An owner who sets an expensive cold contract can stall only their own sweeps.
- See AUDIT.md for review findings.
