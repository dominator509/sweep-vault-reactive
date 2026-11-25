# Sweep Vault

Set it and forget it savings rule on Reactive Omni. You set a cap and a cold address. Whenever a deposit pushes your vault balance over the cap, a Reactive contract on Lasna sees the `Deposited` event and requests a callback that sweeps the excess to your cold address. No bot, no keeper.

Track: Set It and Forget It. License: Apache-2.0.

## How it works
- `contracts/SweepVault.sol` (Ethereum Sepolia): `setRule(cap, cold)`, `deposit(owner)`, `withdraw`, and `sweep` (callable only through the Reactive callback proxy, only for the trusted reactive contract).
- `contracts/SweepReactive.sol` (Lasna): subscribes to the vault's `Deposited` event and calls `requestCallbackV_1_0` with a `sweep` payload.
- The vault re-reads state in `sweep`, so stale or repeated callbacks are harmless.

## Live testnet run
See `deployment.json`.
- Vault (Eth Sepolia): 0x447bffDe3A4d0f380Ee168593D25e81A95AB7314
- Reactive (Lasna): 0x74575ba58d33158622F520194EFCCaa1F1c655df
- Callback gas 1,000,000. Tested with two brand-new, never-used cold addresses, both swept:
  - cold 0x3a5808eA73c510B02cFA77877CEd36a815463ad2: setRule 0xc1f437fbbbe889fba48dd15c59db68a725ab4872421386fbc15ce727cc03860e, deposit 0.0006 ETH 0x56b4e644b0c7bfd968e2a5b38f7d71d3ff88edcd6d7772594b9209af043a5a5c, Swept 0x0dde31acd035875b7fe6d1af1e107f8f3371ca642e5d3be5e876432fc3714099 (0.0004 ETH, cap 0.0002)
  - cold 0x42EFC37179EB01ee5a2F42027f5465DD6C0D2163: setRule 0xb40b78e45ce6bcf3432435df6c8e54938d46715fb63ed45c31d7c3142e6ff0c5, deposit 0.0006 ETH 0x3f0bf4c90a809d19e915cda0c0370b73d91223e477049aa45603dc32584133ad, Swept 0x62c94657824eba9c781f4cc8507fef603d86bdff5cf9f5cc94fcd3cb0da3ae86 (0.0006 ETH)
- An earlier build with 400,000 callback gas swept to an existing wallet but failed (CallbackFailure) for a never-used cold address, which is why the gas was raised.

## Run it
```
git clone https://github.com/Reactive-Network/reactive-lib-omni vendor/reactive-lib-omni
npm install && npm test   # 11 tests
```
Deploy: `node deploy.mjs` (vault, addresses precomputed from nonces), `node deploy-reactive.mjs <vault>`, then `node demo.mjs <vault> <cold>`. Wallet key is read from `$KEY_FILE` or `~/.reactive/key`; env knobs: VAULT_FLOAT, REACTIVE_FUNDING (deploy), CAP, DEPOSIT (demo); use a throwaway testnet key only.

See `AUDIT.md` for what is tested, what is not, and where a reviewer should look first. License: Apache-2.0 (`LICENSE`).

## Known limits (demo scope)
- Testnet demo, not for real funds. Anyone can deposit for any owner, and every deposit triggers a paid callback, so spam costs the float more than it costs the spammer. A real version needs a minimum deposit or an over-cap-only event.
- Callback fees are paid from a separate fee float (ETH above the sum of user credits). Spam can drain the float and stop sweeps, but cannot touch deposits.
- The trusted callback sender is fixed at deploy. Verify what the proxy injects on a new chain first.
- Callback gas is fixed at 1,000,000. An owner who sets an expensive cold contract can stall only their own sweeps.
- See AUDIT.md for review findings.
