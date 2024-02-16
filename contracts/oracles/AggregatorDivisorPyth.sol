// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAggregatorV3.sol";
import "../interfaces/IPyth.sol";

/**
 * @title AggregatorDivisor
 * @notice This contract merges
 * two aggregators data into one
 * by dividing the first price by
 * the other.
 */
contract AggregatorDivisorPyth {
  uint8 public decimals;
  address public pythAddress;
  bytes32 public oracle0;
  address public oracle1;
  uint8 public oracle1decimals;

  constructor(
    uint8 _decimals,
    address _pythAddress,
    bytes32 _oracle0,
    address _oracle1
  ) {
    decimals = _decimals;
    pythAddress = _pythAddress;
    oracle0 = _oracle0;
    oracle1 = _oracle1;
    oracle1decimals = IAggregatorV3(oracle1).decimals();
  }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    PythStructs.Price memory pythPrice = IPyth(pythAddress).getPriceUnsafe(oracle0);
    int64 price0 = pythPrice.price;
    uint updatedAt0 = pythPrice.publishTime;
    require(price0 > 0 && updatedAt0 > 0, "Invalid oracle 0");
    (, int price1, uint startedAt1, uint updatedAt1, ) = IAggregatorV3(oracle1).latestRoundData();
    require(price1 > 0 && startedAt1 > 0 && updatedAt1 > 0, "Invalid oracle 1");

    uint finalUpdatedAt = updatedAt0 > updatedAt1 ? updatedAt0 : updatedAt1;
    uint composedPrice = 10**(decimals+oracle1decimals) * uint(uint64(price0));
    if (pythPrice.expo > 0) {
      composedPrice *= 10**(uint32(-pythPrice.expo));
    }
    composedPrice /= uint(price1);
    if (pythPrice.expo < 0) {
      composedPrice /= 10**(uint32(-pythPrice.expo));
    }

    return (
      0,
      int(composedPrice),
      startedAt1,
      finalUpdatedAt,
      0
    );
  }
}