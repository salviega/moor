// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Demo-only ERC20 for Sepolia (05 §1): anyone can mint. WBTC uses 8 decimals, USDC 6.
/// @dev Never deployed anywhere with value. Not part of the product.
contract TestToken is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Open faucet. Demo infrastructure, labelled as such everywhere it appears.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
