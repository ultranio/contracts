// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "./Ultran.sol";

contract LiquidationFinder {
  struct Liquidation {
    address account;        // owner of oven
    uint ovenId;            // id of oven
    uint collateral;        // collateral amount
    uint amount;            // minted synthetic amount
    uint ratio;             // collateralization ratio
  }
  Ultran ultran;

  constructor(address ultranAddr) {
    ultran = Ultran(ultranAddr);
  }

  function getLiquidation(uint fassetId, uint maxRatio, int skip) public view returns(
    Liquidation memory liq
  ) {
    uint nUsers = ultran.getUsersLength();
    for (uint256 i = nUsers-1; i >= 0; i--) {
      address userAddr = ultran.users(i);
      uint nOvens = ultran.getOvensLength(userAddr);
      for (uint256 y = 0; y < nOvens; y++) {
        (address acc, uint colla, uint am, uint token) = ultran.ovens(userAddr,y);
        if (token != fassetId)
          continue;
        uint ovenRatio = ultran.getOvenRatio(userAddr, y);
        if (ovenRatio < maxRatio) {
          if (skip > 0)
            skip--;
          else
            return Liquidation({
              account: acc,
              ovenId: y,
              collateral: colla,
              amount: am,
              ratio: ovenRatio
            });
        }
      }
      if (i == 0)
        return Liquidation({
          account: address(0),
          ovenId: 0,
          collateral: 0,
          amount: 0,
          ratio: 0
        });
    }
  }
}