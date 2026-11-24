// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.29;

import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { AbstractCallback } from "@reactive/src/base/AbstractCallback.sol";

/// @title SweepVault (destination chain)
/// @notice A tiny savings vault. Anyone can deposit ETH for an owner. When the vault balance
/// goes above the owner's cap, the Reactive contract calls `sweep` and the excess moves to
/// the owner's cold address. No bot, no keeper: the rule lives on-chain.
contract SweepVault is AbstractCallback {
    event Deposited(address indexed owner, uint256 amount, uint256 balanceAfter);
    event Swept(address indexed owner, address indexed cold, uint256 amount);
    event CapSet(address indexed owner, uint256 cap, address cold);

    struct Rule { uint256 cap; address cold; }
    mapping(address => Rule) public rules;
    mapping(address => uint256) public balanceOf;

    constructor(IPayable callbackProxy_, address callbackSender_) payable AbstractCallback(callbackProxy_, callbackSender_) {}

    /// @notice Set your own cap (wei) and the cold address that receives the excess.
    function setRule(uint256 cap, address cold) external {
        require(cold != address(0), "cold=0");
        rules[msg.sender] = Rule(cap, cold);
        emit CapSet(msg.sender, cap, cold);
    }

    function deposit(address owner) external payable {
        require(msg.value > 0, "no value");
        require(owner != address(0), "owner=0");
        balanceOf[owner] += msg.value;
        emit Deposited(owner, msg.value, balanceOf[owner]);
    }

    /// @notice Called by the Reactive Network (via the callback proxy) when a deposit pushes
    /// an owner above the cap. Safe to call with stale data: it re-reads state.
    function sweep(address reactive_, address owner)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        Rule memory r = rules[owner];
        uint256 bal = balanceOf[owner];
        if (r.cold == address(0) || bal <= r.cap) return;
        uint256 excess = bal - r.cap;
        balanceOf[owner] = r.cap;
        emit Swept(owner, r.cold, excess);
        (bool ok, ) = r.cold.call{value: excess}("");
        require(ok, "sweep failed");
    }

    /// @notice Owner can always withdraw their own balance.
    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }
}
