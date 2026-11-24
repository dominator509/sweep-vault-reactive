// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.29;

import { ISystemContract } from "@reactive/src/interfaces/ISystemContract.sol";
import { IReactive } from "@reactive/src/interfaces/IReactive.sol";
import { AbstractReactive } from "@reactive/src/base/AbstractReactive.sol";

/// @title SweepReactive (Reactive Lasna)
/// @notice Watches SweepVault `Deposited` events on the destination chain and requests a
/// `sweep` callback on every deposit. The vault itself decides if there is anything to sweep.
contract SweepReactive is AbstractReactive {
    uint256 public immutable destChainId;
    address public immutable vault;
    uint64 public constant CALLBACK_GAS = 400_000;
    // keccak256("Deposited(address,uint256,uint256)")
    uint256 private constant DEPOSITED_TOPIC0 = uint256(keccak256("Deposited(address,uint256,uint256)"));

    constructor(uint256 destChainId_, address vault_) payable {
        destChainId = destChainId_;
        vault = vault_;
        SYSTEM.subscribe(destChainId_, vault_, DEPOSITED_TOPIC0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    /// @inheritdoc IReactive
    function react(LogRecord calldata log_) external onlySystem {
        if (log_.chainId != destChainId || log_.contractAddress != vault || log_.topic0 != DEPOSITED_TOPIC0) return;
        address owner = address(uint160(log_.topic1));
        // The proxy overwrites the first argument with this contract's address.
        bytes memory payload = abi.encodeWithSignature("sweep(address,address)", address(0), owner);
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: destChainId,
                recipient: vault,
                gasLimit: CALLBACK_GAS,
                payload: payload
            })
        );
    }
}
