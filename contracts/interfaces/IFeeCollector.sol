// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

interface IFeeCollector {
    function transferERC20(address token, address to, uint256 amount) external;
    function transferETH(address payable _to) external payable;
}
