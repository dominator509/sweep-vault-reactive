// Compile with solc-js (no foundry available). Usage: node build.mjs
import solc from 'solc';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const files = ['SweepVault.sol', 'SweepReactive.sol', 'mocks/MockSystem.sol'];
const sources = Object.fromEntries(files.map((f) => [f, { content: readFileSync(`contracts/${f}`, 'utf8') }]));
const input = { language: 'Solidity', sources, settings: { evmVersion: 'shanghai', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const findImports = (p) => {
  const q = p.replace('@reactive/', 'vendor/reactive-lib-omni/');
  try { return { contents: readFileSync(resolve(q), 'utf8') }; } catch { return { error: 'not found ' + p }; }
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
for (const e of out.errors || []) console.error(e.formattedMessage);
if ((out.errors || []).some((e) => e.severity === 'error')) process.exit(1);
mkdirSync('out', { recursive: true });
for (const f of files) for (const [n, c] of Object.entries(out.contracts[f])) writeFileSync(`out/${n}.json`, JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }));
console.log('compiled', files.join(', '));
