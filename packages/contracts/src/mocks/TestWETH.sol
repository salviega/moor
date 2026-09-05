// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal WETH9-compatible token for chains where we do not want to depend on a
/// third-party WETH. SwapVM only needs it for its ETH receive path, which Moor never uses.
contract TestWETH is ERC20 {
    error TransferFailed();

    constructor() ERC20("Test Wrapped Ether", "tWETH") { }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{ value: amount }("");
        if (!ok) {
            revert TransferFailed();
        }
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}
