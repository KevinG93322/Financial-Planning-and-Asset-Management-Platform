// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local demo asset. Each address may claim the faucet once. Tokens have no monetary value.
contract DemoAsset is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000 ether;

    mapping(address => bool) public claimed;

    event FaucetClaimed(address indexed account, uint256 amount);

    error AlreadyClaimed();

    constructor() ERC20("Demo Asset", "DEMO") {}

    function faucet() external {
        if (claimed[msg.sender]) revert AlreadyClaimed();
        claimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
}
