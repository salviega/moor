// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraits } from "@1inch/swap-vm/src/libs/MakerTraits.sol";

import { MoorProgram } from "../src/MoorProgram.sol";
import { TestToken } from "../src/mocks/TestToken.sol";

/// @notice Phase 1 (07): ships a test position from the broadcaster's wallet — the broadcaster is the
/// maker, exactly as the holder's Ledger will be in phase 3. Demo only: mints the committed tUSDC.
///
/// Env (all optional):
///   MOOR_AMOUNT      committed quote (tUSDC raw, default 1000e6)
///   MOOR_PRICE_MIN   quote per base, integer (default 58000)
///   MOOR_PRICE_MAX   quote per base, integer (default 62000)
///   MOOR_FEE_BPS     SwapVM fee units, 1e7 = 100 % (default 30000 = 0.3 %)
///   MOOR_DAYS        days until the deadline (default 30)
///
/// Writes deployments/positions/<chainId>-<strategyHash>.json for DemoTaker.s.sol and the CHANGELOG.
contract ShipDemo is Script {
    function run() external {
        string memory dep =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
        IAqua aqua = IAqua(vm.parseJsonAddress(dep, ".aqua"));
        address router = vm.parseJsonAddress(dep, ".swapVmRouter");
        TestToken quote = TestToken(vm.parseJsonAddress(dep, ".testUsdc")); // spent
        TestToken base = TestToken(vm.parseJsonAddress(dep, ".testWbtc")); // bought

        uint256 amount = vm.envOr("MOOR_AMOUNT", uint256(1000e6));
        uint256 priceMin = vm.envOr("MOOR_PRICE_MIN", uint256(58_000));
        uint256 priceMax = vm.envOr("MOOR_PRICE_MAX", uint256(62_000));
        uint24 feeBps = uint24(vm.envOr("MOOR_FEE_BPS", uint256(30_000)));
        uint40 deadline = uint40(block.timestamp + vm.envOr("MOOR_DAYS", uint256(30)) * 1 days);

        (address tokenA, address tokenB) =
            address(quote) < address(base) ? (address(quote), address(base)) : (address(base), address(quote));
        // Same arithmetic as packages/core sqrtPriceX18: priceBperA = baseRaw/quoteRaw when base is tokenB.
        bool baseIsTokenB = address(base) == tokenB;
        uint256 baseRaw = 10 ** IERC20Metadata(address(base)).decimals();
        uint256 quoteDec = 10 ** IERC20Metadata(address(quote)).decimals();
        uint256 sqrtLo = _sqrtPrice(priceMin, baseRaw, quoteDec, baseIsTokenB);
        uint256 sqrtHi = _sqrtPrice(priceMax, baseRaw, quoteDec, baseIsTokenB);
        (uint256 sqrtMin, uint256 sqrtMax) = sqrtLo < sqrtHi ? (sqrtLo, sqrtHi) : (sqrtHi, sqrtLo);

        MoorProgram.Params memory p = MoorProgram.Params({
            tokenA: tokenA,
            tokenB: tokenB,
            takerTokenIn: address(base), // the holder buys base: only takers bringing base may execute
            feeBps: feeBps,
            deadline: deadline,
            sqrtPriceMin: sqrtMin,
            sqrtPriceMax: sqrtMax
        });

        vm.startBroadcast();
        address maker = msg.sender;
        if (quote.balanceOf(maker) < amount) {
            quote.mint(maker, amount - quote.balanceOf(maker));
        }
        if (IERC20(address(quote)).allowance(maker, address(aqua)) < amount) {
            quote.approve(address(aqua), type(uint256).max);
        }
        if (IERC20(address(base)).allowance(maker, address(aqua)) == 0) {
            base.approve(address(aqua), type(uint256).max);
        }

        ISwapVM.Order memory order = MoorProgram.order(maker, p);
        address[] memory tokens = new address[](2);
        tokens[0] = tokenA;
        tokens[1] = tokenB;
        uint256[] memory amounts = new uint256[](2);
        amounts[tokenA == address(quote) ? 0 : 1] = amount;
        bytes32 strategyHash = aqua.ship(router, abi.encode(order), tokens, amounts);
        vm.stopBroadcast();

        require(strategyHash == MoorProgram.strategyHash(order), "hash mismatch");
        console2.log("maker            ", maker);
        console2.log("strategyHash     ", vm.toString(strategyHash));
        console2.log("committed (quote)", amount);
        console2.log("range quote/base ", priceMin, priceMax);
        console2.log("deadline         ", uint256(deadline));

        string memory obj = "position";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "maker", maker);
        vm.serializeUint(obj, "traits", MakerTraits.unwrap(order.traits));
        vm.serializeBytes(obj, "data", order.data);
        vm.serializeAddress(obj, "tokenA", tokenA);
        vm.serializeAddress(obj, "tokenB", tokenB);
        vm.serializeAddress(obj, "takerTokenIn", address(base));
        vm.serializeUint(obj, "feeBps", feeBps);
        vm.serializeUint(obj, "deadline", deadline);
        vm.serializeUint(obj, "sqrtPriceMin", sqrtMin);
        vm.serializeUint(obj, "sqrtPriceMax", sqrtMax);
        vm.serializeUint(obj, "amount", amount);
        string memory json = vm.serializeBytes32(obj, "strategyHash", strategyHash);
        string memory path = string.concat(
            vm.projectRoot(),
            "/deployments/positions/",
            vm.toString(block.chainid),
            "-",
            vm.toString(strategyHash),
            ".json"
        );
        vm.writeJson(json, path);
        console2.log("written          ", path);
    }

    /// @dev sqrt(priceBperA * 1e36), priceBperA = baseRaw/(price*quoteRaw) if base is tokenB, else the inverse.
    function _sqrtPrice(
        uint256 quotePerBase,
        uint256 baseRaw,
        uint256 quoteDec,
        bool baseIsTokenB
    )
        internal
        pure
        returns (uint256)
    {
        uint256 quoteRaw = quotePerBase * quoteDec;
        return baseIsTokenB ? Math.sqrt(baseRaw * 1e36 / quoteRaw) : Math.sqrt(quoteRaw * 1e36 / baseRaw);
    }
}
