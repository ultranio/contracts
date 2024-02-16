// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

interface IuAsset {
  function decimals() external returns (uint8);
  function mint(address _to, uint256 _amount) external;
  function burn(address _from, uint256 _amount) external;
  function balanceOf(address account) external view returns (uint256);
}  