// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { console2 } from "forge-std/console2.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { AquaSwapVMTest } from "@1inch/swap-vm/test/base/AquaSwapVMTest.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraits } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { Deadline } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { JumpIfTokenIn } from "@1inch/swap-vm/src/instructions/Jumps.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { dynamic } from "@1inch/swap-vm/test/utils/Dynamic.sol";

import { MoorProgram, MoorProgramFactory } from "../src/MoorProgram.sol";

/// @notice Phase 1 (07): the promises of 04 §6, each with a test that tries to break it.
/// The holder ("maker") commits tokenA and buys tokenB. Prices are tokenB per tokenA, 1e18-scaled
/// under the sqrt: with only tokenA in the balance the curve sits at sqrtPriceMin and climbs.
contract MoorProgramTest is AquaSwapVMTest {
    MoorProgramFactory internal factory;

    uint256 internal constant COMMITTED_A = 1000e18;
    uint40 internal constant DEADLINE = 1_800_000_000;
    uint24 internal constant FEE_BPS = 30_000; // 0.3 % of 1e7

    function setUp() public override {
        super.setUp();
        factory = new MoorProgramFactory();
        vm.warp(DEADLINE - 1 days);
    }

    // ---------------------------------------------------------------- helpers

    function _params() internal view returns (MoorProgram.Params memory) {
        return MoorProgram.Params({
            tokenA: address(tokenA),
            tokenB: address(tokenB),
            takerTokenIn: address(tokenB), // the holder buys B: only takers bringing B may execute
            feeBps: FEE_BPS,
            deadline: DEADLINE,
            sqrtPriceMin: Math.sqrt(0.5e18 * 1e18), // 0.5 B per A  → first fills at 2 A per B
            sqrtPriceMax: Math.sqrt(2e18 * 1e18) // 2   B per A  → last fills at 0.5 A per B
         });
    }

    /// @dev Ships the position: all of tokenA, none of tokenB. Returns the order and its Aqua hash.
    function _shipBuyPosition() internal returns (ISwapVM.Order memory order, bytes32 strategyHash) {
        order = MoorProgram.order(maker, _params());
        tokenA.mint(maker, COMMITTED_A);
        strategyHash = shipStrategy(order, tokenA, tokenB, COMMITTED_A, 0);
        assertEq(strategyHash, MoorProgram.strategyHash(order), "library hash == Aqua hash");
        assertEq(strategyHash, swapVM.hash(order), "library hash == SwapVM hash");
    }

    /// @dev The allowed direction: the taker brings tokenB, receives tokenA.
    function _buy(uint256 amountB) internal view returns (SwapProgram memory) {
        return SwapProgram({
            amount: amountB,
            taker: taker,
            tokenA: tokenA,
            tokenB: tokenB,
            zeroForOne: false,
            isExactIn: true
        });
    }

    /// @dev The forbidden direction: the taker brings tokenA (would make the position sell back what it bought).
    function _sellBack(uint256 amountA) internal view returns (SwapProgram memory) {
        return SwapProgram({
            amount: amountA,
            taker: taker,
            tokenA: tokenA,
            tokenB: tokenB,
            zeroForOne: true,
            isExactIn: true
        });
    }

    // ---------------------------------------------------------------- layout

    function test_layout_mainPcMatchesInstructionSizes() public view {
        uint256 expected = Deadline.sizeOf(DEADLINE) + JumpIfTokenIn.sizeOf(address(tokenB), 0) + Deadline.sizeOf(0);
        assertEq(uint256(factory.mainPc()), expected, "MAIN_PC");
        assertEq(expected, 38);
        assertEq(factory.build(_params()).length, 38 + 5 + 66, "program length");
    }

    function test_build_rejectsUnsortedTokensAndForeignTakerToken() public {
        MoorProgram.Params memory p = _params();
        (p.tokenA, p.tokenB) = (p.tokenB, p.tokenA);
        vm.expectRevert(abi.encodeWithSelector(MoorProgram.MoorTokensNotSorted.selector, p.tokenA, p.tokenB));
        factory.build(p);

        p = _params();
        p.takerTokenIn = address(0xBEEF);
        vm.expectRevert(abi.encodeWithSelector(MoorProgram.MoorTakerTokenNotInPair.selector, address(0xBEEF)));
        factory.build(p);
    }

    // ---------------------------------------------------------------- the direction gate (04 §6, 05 §5b)

    function test_buy_fillsInTheAllowedDirection() public {
        (ISwapVM.Order memory order,) = _shipBuyPosition();
        SwapProgram memory sp = _buy(100e18);
        mintTokenInToTaker(sp);

        (uint256 quotedIn, uint256 quotedOut) = quote(sp, order);
        (uint256 amountIn, uint256 amountOut) = swap(sp, order);

        assertEq(amountIn, quotedIn, "quote/swap in");
        assertEq(amountOut, quotedOut, "quote/swap out");
        assertGt(amountOut, 0, "the holder bought something");
        // Spot starts at 0.5 B per A: 100 B is worth up to 200 A, minus curve movement and the fee.
        assertLt(amountOut, 200e18, "never better than the top of the range");
        assertGt(amountOut, 150e18, "but close to it for a small fill");

        (uint256 balA, uint256 balB) = getAquaBalances(MoorProgram.strategyHash(order));
        assertEq(balA, COMMITTED_A - amountOut, "tokenA left the virtual balance");
        assertGt(balB, 0, "tokenB arrived, fee included");
        assertEq(tokenA.balanceOf(address(taker)), amountOut, "taker received tokenA");
    }

    function test_sellBack_revertsInQuoteAndSwap() public {
        (ISwapVM.Order memory order,) = _shipBuyPosition();
        // Put some B into the position first, so there is something a seller could try to take back.
        SwapProgram memory buy = _buy(100e18);
        mintTokenInToTaker(buy);
        swap(buy, order);

        SwapProgram memory sell = _sellBack(10e18);
        mintTokenInToTaker(sell);
        bytes memory expected = abi.encodeWithSelector(Deadline.DeadlineReached.selector, uint256(0));

        ISwapVM viewer = swapVM.asView();
        bytes memory data = takerData(address(taker), true, true);
        vm.expectRevert(expected);
        viewer.quote(order, 10e18, data);
        vm.expectRevert(expected);
        swap(sell, order);
    }

    function test_boughtStaysBought_afterFullConversion() public {
        (ISwapVM.Order memory order,) = _shipBuyPosition();
        // Ask for every last tokenA as exactOut: the taker brings whatever tokenB the curve demands.
        SwapProgram memory buy = SwapProgram({
            amount: COMMITTED_A,
            taker: taker,
            tokenA: tokenA,
            tokenB: tokenB,
            zeroForOne: false,
            isExactIn: false
        });
        mintTokenInToTaker(buy, 10_000e18);
        (, uint256 amountOut) = swap(buy, order);
        assertEq(amountOut, COMMITTED_A, "the whole commitment converted");

        (uint256 balA, uint256 balB) = getAquaBalances(MoorProgram.strategyHash(order));
        assertEq(balA, 0, "no tokenA left");
        assertGt(balB, 0, "tokenB held in the position");

        // The price could come back down for years: nobody can make the position sell its tokenB.
        SwapProgram memory sell = _sellBack(1e18);
        mintTokenInToTaker(sell);
        vm.expectRevert(abi.encodeWithSelector(Deadline.DeadlineReached.selector, uint256(0)));
        swap(sell, order);
    }

    // ---------------------------------------------------------------- lifecycle

    function test_deadline_stopsEverything() public {
        (ISwapVM.Order memory order,) = _shipBuyPosition();
        SwapProgram memory buy = _buy(1e18);
        mintTokenInToTaker(buy);
        vm.warp(uint256(DEADLINE) + 1);
        vm.expectRevert(abi.encodeWithSelector(Deadline.DeadlineReached.selector, uint256(DEADLINE)));
        swap(buy, order);
    }

    function test_dock_onlyTheMaker() public {
        (, bytes32 strategyHash) = _shipBuyPosition();
        address[] memory tokens = dynamic([address(tokenA), address(tokenB)]);

        // Anyone else has no balances under their own key: Aqua refuses.
        vm.prank(address(0xA11CE));
        vm.expectRevert(
            abi.encodeWithSelector(IAqua.DockingShouldCloseAllTokens.selector, address(swapVM), strategyHash)
        );
        aqua.dock(address(swapVM), strategyHash, tokens);

        // The maker can, and afterwards the strategy is gone for good.
        vm.prank(maker);
        aqua.dock(address(swapVM), strategyHash, tokens);
        vm.expectRevert();
        aqua.safeBalances(maker, address(swapVM), strategyHash, address(tokenA), address(tokenB));
    }

    // ---------------------------------------------------------------- golden vectors for packages/core

    /// @dev Fixed inputs → fixed bytes. `packages/core/test/program.test.ts` pins the same values.
    function test_goldenVectors() public view {
        MoorProgram.Params memory p = MoorProgram.Params({
            tokenA: 0x1111111111111111111111111111111111111111,
            tokenB: 0x2222222222222222222222222222222222222222,
            takerTokenIn: 0x2222222222222222222222222222222222222222,
            feeBps: 30_000,
            deadline: 1_800_000_000,
            sqrtPriceMin: 707_106_781_186_547_524, // sqrt(0.5) * 1e18, floored
            sqrtPriceMax: 1_414_213_562_373_095_048 // sqrt(2)   * 1e18, floored
         });
        address holder = 0xAA1aEf44DDE610F433f271C6A8749139DD5162E1;
        bytes memory program = factory.build(p);
        ISwapVM.Order memory o = factory.order(holder, p);
        console2.log("program:");
        console2.logBytes(program);
        console2.log("traits:");
        console2.logBytes32(bytes32(MakerTraits.unwrap(o.traits)));
        console2.log("data:");
        console2.logBytes(o.data);
        console2.log("strategyHash:");
        console2.logBytes32(factory.strategyHash(holder, p));
    }
}
