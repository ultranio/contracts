// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import './interfaces/IERC20.sol';

contract FeeCollector is Ownable {
  constructor() {}

  function transferERC20(address token, address to, uint256 amount) external onlyOwner {
    IERC20(token).transfer(to, amount);
  }

  function transferETH(address payable _to) external payable onlyOwner {
    // Call returns a boolean value indicating success or failure.
    // This is the current recommended method to use.
    (bool sent,) = _to.call{value: msg.value}("");
    require(sent, "Failed to send Ether");
  }
}