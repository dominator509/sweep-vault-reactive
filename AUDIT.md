# Audit handoff: Sweep Vault

## What it is
A savings rule that runs on-chain with no keeper. A user sets a cap and a cold address in `SweepVault` (Ethereum Sepolia). When a deposit is made, `SweepReactive` (Reactive Network, Lasna testnet) sees the `Deposited` event and requests a callback. The callback calls `sweep`, which moves anything above the cap to the cold address. Testnets only, demo code, not for real funds.

## Event and judging
Reactive Omni Buildathon on DoraHacks, track "Set It and Forget It". Deadline 2026-12-05 20:00 UTC. Judged on Execution (on-chain reactive transactions and callbacks), Integration (use of Reactive Omni primitives), Usefulness, Craft (code quality and docs). Our internal target date for the review is before Dec 2.

## Code map
- `contracts/SweepVault.sol` (about 60 lines): deposit, setRule, withdraw, sweep. `sweep` is guarded by `onlyServiceProvider` (callback proxy) and `onlyCallbackSender(reactive_)`.
- `contracts/SweepReactive.sol` (about 40 lines): subscribes in the constructor, `react()` builds the callback with `requestCallbackV_1_0`.
- Dependency: Reactive-Network/reactive-lib-omni at commit 3ade0dcf1d27e67e5783ef807e73a1b9e0c0cce8, cloned into `vendor/` (not committed).
- Solidity 0.8.29, evm shanghai, optimizer 200 runs.

## Run and test
```
git clone https://github.com/Reactive-Network/reactive-lib-omni vendor/reactive-lib-omni
git -C vendor/reactive-lib-omni checkout 3ade0dcf1d27e67e5783ef807e73a1b9e0c0cce8
npm install
npm test        # compiles with solc, then 11 tests on an in-process ganache chain
```
Static analysis (Slither 0.11 style, run by us): `slither contracts/SweepVault.sol --solc-remaps "@reactive/=vendor/reactive-lib-omni/" --solc-args "--evm-version shanghai" --filter-paths "vendor|node_modules"`.

## What has been tested
- 11 local tests: sweep above cap, no-op below cap, repeat sweeps, two owners, no rule set, access control (non-proxy and wrong reactive sender rejected), withdraw limits, zero cold address, zero deposit, and a cold address that reverts (sweep reverts, balance intact).
- One live testnet run, see `deployment.json`: setRule, deposit 0.004 ETH, Reactive-triggered sweep of 0.003 ETH about 6 s later.
- Slither: only informational findings (low-level calls, missing zero-check on `vault_` in the reactive constructor).

## Not tested yet
- No fuzzing, no invariant tests, no formal checks, no independent review.
- Only one live run, one owner, burn address as cold address.
- Callback gas limit (1,000,000) is fixed and not stress-tested.
- Behavior when the callback proxy or Reactive Network is delayed or drops an event.
- A contract cold address with a payable fallback that re-enters (state is updated before the external call, but this is our reading only).

## Please look hardest at
1. Access control on `sweep` and the trust assumptions on the `callbackSender` immutable.
2. Reentrancy and griefing through `deposit(owner)` (anyone can deposit for anyone) and the cold address call.
3. Correct use of the Reactive Omni subscribe and callback APIs (topic filters, payload encoding, the proxy overwriting the first argument).
4. Anything that would stop the live demo from working again.

## Out of scope
Deployment scripts (`deploy.mjs`, `deploy-reactive.mjs`, `demo.mjs`, `faucet-lreact.mjs`) other than obvious bugs. Mainnet use. Front end (none).

## Secrets
None in the repo. The deploy scripts read a throwaway testnet key from a local file that is not committed. Please do not send keys or tokens.

## Reviewer findings so far
Review 1 (Hermes, text-only review of the source, 2026-11-24): one finding rated HIGH, three MEDIUM or LOW risks, and test gaps.
- HIGH, "anyone can setRule for an address that received a deposit and take the funds": not reproducible. `setRule` writes `rules[msg.sender]`, so a caller can only set their own rule, and `sweep` reads the rule of the deposit's owner. Tests `a third party cannot redirect...` and `invariant: sum of balances...` (added in this PR) show an attacker rule changes nothing for the victim, before or after the victim sets a rule.
- MEDIUM, reentrancy via a hostile cold address: state is updated before the external call and `sweep` can only be called by the callback proxy, so re-entry can only touch the caller's own balance. Not exploited in any test yet; a reentrant-cold test is still wanted.
- MEDIUM, gas griefing with a reverting or expensive cold address: the owner chooses their own cold address, so this only hurts that owner. A revert leaves the balance intact (tested).
- LOW, forced ETH (selfdestruct) is not credited and is stuck: true, no funds of users at risk. LOW, no zero-check on `vault_` in the reactive constructor: true, informational.
- Demo notes accepted: use a normal wallet as the cold address in the next demo, show the cap arithmetic.

Review 2 (independent LLM review, 2026-11-24, findings only). No critical or high findings. Reproduced against this repo:
- Fixed here: `deposit(address(0))` locked funds forever (reproduced; now reverts, with a test). `npm ci` failed on Linux because of `fsevents` in the lockfile (reproduced; lockfile regenerated, `npm ci` passes). `deployment.json` and `deploy.mjs` used two different key sets (`deploy.mjs` now writes the committed keys). `deploy.mjs` now checks that both contracts landed at the predicted addresses before writing `deployment.json`.
- Fixed after the user's go: callback fee payments could spend ETH backing user credits (Mzungu F2, Hermes and Codex "inherited pay(amount)"; reproduced: with 2 ETH credited, the proxy's `pay(1 ETH)` left 1 ETH against 2 ETH of credits). `SweepVault` no longer inherits the library payer. It has its own `pay` that can only draw the fee float (ETH above the new `totalCredits`), so credits stay backed and owners can always redeem in full. If the float runs out, callbacks fail instead of touching deposits. Plain ETH sent to the vault tops up the float. Setting the vault itself as the cold address (Codex F3, accounting trap) is now rejected.
- Added `react()` tests with a mocked system contract (log filter, callback payload, onlySystem).
- Documented demo trade-offs, not changed:
  - Spam deposits. `deposit(owner)` is permissionless and each `Deposited` event triggers a paid callback, even below the cap. The float pays for it, so spam can exhaust the float and stop sweeps, but no longer touches user deposits. Real use needs a minimum deposit or an over-cap-only event.
  - `_CALLBACK_SENDER` is immutable. The live run shows the Sepolia proxy injects the reactive contract address, so wiring is correct today. Check injection per chain before any redeploy.
  - The callback gas limit is a fixed 1,000,000. A cold contract with an expensive `receive()` can stall its own owner's sweeps only.
- The deployed Sepolia vault (0x38D0...5d6) is the earlier build and is not redeployed. It lacks the zero-owner, fee-float and self-cold fixes, which apply to the next deploy.
