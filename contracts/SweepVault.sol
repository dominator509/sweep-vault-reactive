// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.29;

import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { IPayer } from "@reactive/src/interfaces/IPayer.sol";

/// @title SweepVault (destination chain)
/// @notice A tiny savings vault. Anyone can deposit ETH for an owner. When the vault balance
/// goes above the owner's cap, the Reactive contract calls `sweep` and the excess moves to
/// the owner's cold address. No bot, no keeper: the rule lives on-chain.
contract SweepVault is IPayer {
    error NotAuthorized(address sender_, address provider_);
    error CallbackNotAuthorized(address sender_, address expectedSender_);
    error InsufficientFloat(uint256 required_, uint256 available_);
    error TransferFailed();

    /// @notice Callback proxy: the only caller of `sweep` and `pay`.
    IPayable public immutable _SERVICE_PROVIDER;
    /// @notice The reactive contract the proxy must report as the first `sweep` argument.
    address public immutable _CALLBACK_SENDER;
    /// @notice Sum of all `balanceOf` credits. ETH above this is the fee float.
    uint256 public totalCredits;

    event Deposited(address indexed owner, uint256 amount, uint256 balanceAfter);
    event Swept(address indexed owner, address indexed cold, uint256 amount);
    event CapSet(address indexed owner, uint256 cap, address cold);

    struct Rule { uint256 cap; address cold; }
    mapping(address => Rule) public rules;
    mapping(address => uint256) public balanceOf;

    constructor(IPayable callbackProxy_, address callbackSender_) payable {
        _SERVICE_PROVIDER = callbackProxy_;
        _CALLBACK_SENDER = callbackSender_;
    }

    modifier onlyServiceProvider() {
        if (msg.sender != address(_SERVICE_PROVIDER)) revert NotAuthorized(msg.sender, address(_SERVICE_PROVIDER));
        _;
    }

    /// @notice Plain ETH sent here is not credited to anyone: it tops up the fee float.
    receive() external payable {}

    /// @notice Callback fee payment. Unlike the library default, this can only draw the fee float
    /// (ETH above `totalCredits`), so it can never spend ETH that backs user balances.
    function pay(uint256 amount_) external onlyServiceProvider {
        uint256 float_ = address(this).balance - totalCredits;
        if (amount_ > float_) revert InsufficientFloat(amount_, float_);
        if (amount_ > 0) {
            (bool ok, ) = payable(msg.sender).call{value: amount_}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Set your own cap (wei) and the cold address that receives the excess.
    function setRule(uint256 cap, address cold) external {
        require(cold != address(0) && cold != address(this), "bad cold");
        rules[msg.sender] = Rule(cap, cold);
        emit CapSet(msg.sender, cap, cold);
    }

    function deposit(address owner) external payable {
        require(msg.value > 0, "no value");
        require(owner != address(0), "owner=0");
        balanceOf[owner] += msg.value;
        totalCredits += msg.value;
        emit Deposited(owner, msg.value, balanceOf[owner]);
    }

    /// @notice Called by the Reactive Network (via the callback proxy) when a deposit pushes
    /// an owner above the cap. Safe to call with stale data: it re-reads state.
    function sweep(address reactive_, address owner)
        external
        onlyServiceProvider
        
    {
        if (reactive_ != _CALLBACK_SENDER) revert CallbackNotAuthorized(reactive_, _CALLBACK_SENDER);
        Rule memory r = rules[owner];
        uint256 bal = balanceOf[owner];
        if (r.cold == address(0) || bal <= r.cap) return;
        uint256 excess = bal - r.cap;
        balanceOf[owner] = r.cap;
        totalCredits -= excess;
        emit Swept(owner, r.cold, excess);
        (bool ok, ) = r.cold.call{value: excess}("");
        require(ok, "sweep failed");
    }

    /// @notice Owner can always withdraw their own balance.
    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        totalCredits -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }
}
