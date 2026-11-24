// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.29;

/// @dev Test-only stand-in for the Reactive system contract. Records calls as events.
contract MockSystem {
    struct Cfg { uint256 chainId; address recipient; uint64 gasLimit; bytes payload; }
    event Subscribed(uint256 chainId, address target, uint256 topic0);
    event CallbackRequested(uint256 chainId, address recipient, uint64 gasLimit, bytes payload);
    function subscribe(uint256 c, address t, uint256 t0, uint256, uint256, uint256) external { emit Subscribed(c, t, t0); }
    function requestCallbackV_1_0(Cfg memory cfg) external { emit CallbackRequested(cfg.chainId, cfg.recipient, cfg.gasLimit, cfg.payload); }
}
