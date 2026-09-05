// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { Deadline } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { JumpIfTokenIn } from "@1inch/swap-vm/src/instructions/Jumps.sol";
import { FeeFlatIn } from "@1inch/swap-vm/src/instructions/FeeFlat.sol";
import { XYCConcentrateSwap } from "@1inch/swap-vm/src/instructions/XYCConcentrate.sol";

/// @title MoorProgram
/// @notice The one SwapVM program Moor ships (05 §1): a one-directional range order of
/// concentrated liquidity, backed by Aqua balances that never leave the holder's wallet.
///
/// Layout, byte offsets are the VM's program counter:
/// ```
///   0  Deadline(uint40)                       7 bytes   past it, nothing executes
///   7  JumpIfTokenIn(takerTokenIn, 38)       24 bytes   the allowed direction jumps over the trap
///  31  Deadline(0)                            7 bytes   any other tokenIn lands here and reverts DeadlineReached(0):
///                                                       that direction expired at epoch 0 (04 §6: bought stays bought)
///  38  FeeFlatIn(feeBps)                      5 bytes   the holder's fee on what the taker brings
///  43  XYCConcentrateSwap(sqrtMin, sqrtMax)  66 bytes   the range; balances come from Aqua
/// ```
/// The trap is `Deadline(0)` and not `Revert` because the official AquaSwapVMRouter does not dispatch
/// the Revert opcode (it would fail as `UnknownOpcode(1)` — see spec/feedback/01_1inch.md).
/// `packages/core` builds the same bytes in TypeScript; the parity test pins both to golden vectors.
library MoorProgram {
    error MoorTokensNotSorted(address tokenA, address tokenB);
    error MoorTakerTokenNotInPair(address takerTokenIn);

    /// @param tokenA Lower address of the pair
    /// @param tokenB Greater address of the pair
    /// @param takerTokenIn The token the taker brings — the one the holder is buying. The only direction that executes
    /// @param feeBps Holder fee on tokenIn, in basis points (1e7 = 100%, as SwapVM's FeeFlatIn)
    /// @param deadline Unix seconds; the ENS subname's expiry mirrors it (05 §7)
    /// @param sqrtPriceMin sqrt(priceB/A) * 1e18, lower bound
    /// @param sqrtPriceMax sqrt(priceB/A) * 1e18, upper bound
    struct Params {
        address tokenA;
        address tokenB;
        address takerTokenIn;
        uint24 feeBps;
        uint40 deadline;
        uint256 sqrtPriceMin;
        uint256 sqrtPriceMax;
    }

    /// @dev Offset of FeeFlatIn: sizeOf(Deadline) + sizeOf(JumpIfTokenIn) + sizeOf(Deadline) = 7 + 24 + 7
    uint16 internal constant MAIN_PC = 38;

    /// @dev The wrong direction lands on a deadline that has always been in the past.
    uint40 internal constant DIRECTION_TRAP = 0;

    function build(Params memory p) internal pure returns (bytes memory) {
        require(p.tokenA < p.tokenB, MoorTokensNotSorted(p.tokenA, p.tokenB));
        require(p.takerTokenIn == p.tokenA || p.takerTokenIn == p.tokenB, MoorTakerTokenNotInPair(p.takerTokenIn));
        return bytes.concat(
            Deadline.build(p.deadline),
            JumpIfTokenIn.build(p.takerTokenIn, MAIN_PC),
            Deadline.build(DIRECTION_TRAP),
            FeeFlatIn.build(p.feeBps),
            XYCConcentrateSwap.build(p.sqrtPriceMin, p.sqrtPriceMax)
        );
    }

    /// @notice The Aqua-backed order: no hooks, no custom receiver, no signature. `maker` is the holder.
    function order(address maker, Params memory p) internal pure returns (ISwapVM.Order memory) {
        return MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: maker,
                receiver: address(0),
                tokenA: p.tokenA,
                tokenB: p.tokenB,
                shouldUnwrapWeth: false,
                useAquaInsteadOfSignature: true,
                allowZeroAmountIn: false,
                hasPreTransferInHook: false,
                hasPostTransferInHook: false,
                hasPreTransferOutHook: false,
                hasPostTransferOutHook: false,
                preTransferInTarget: address(0),
                preTransferInData: "",
                postTransferInTarget: address(0),
                postTransferInData: "",
                preTransferOutTarget: address(0),
                preTransferOutData: "",
                postTransferOutTarget: address(0),
                postTransferOutData: "",
                program: build(p)
            })
        );
    }

    /// @notice What Aqua stores and SwapVM.hash returns for an Aqua order: keccak256(abi.encode(order)).
    function strategyHash(ISwapVM.Order memory o) internal pure returns (bytes32) {
        return keccak256(abi.encode(o));
    }
}

/// @notice Thin, stateless wrapper so tooling and tests can call the library on chain (`cast call`),
/// and so the same code path is what the parity test pins.
contract MoorProgramFactory {
    function build(MoorProgram.Params calldata p) external pure returns (bytes memory) {
        return MoorProgram.build(p);
    }

    function order(address maker, MoorProgram.Params calldata p) external pure returns (ISwapVM.Order memory) {
        return MoorProgram.order(maker, p);
    }

    function strategyHash(address maker, MoorProgram.Params calldata p) external pure returns (bytes32) {
        return MoorProgram.strategyHash(MoorProgram.order(maker, p));
    }

    function mainPc() external pure returns (uint16) {
        return MoorProgram.MAIN_PC;
    }
}
