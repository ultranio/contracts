// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
pragma experimental ABIEncoderV2;

import "./interfaces/IuAsset.sol";
import "./interfaces/IAggregatorV3.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Ultran {
    using SafeERC20 for IERC20;
    struct Oven {
        address account;        // owner of oven
        uint collateral;        // collateral amount
        uint amount;            // minted synthetic amount
        uint token;             // synthetic id
    }
    struct Asset {
        IuAsset token;          // synthetic token address
        uint8 decimals;             // synthetic token decimals
        address oracle;             // oracle address
        uint8 oracleDecimals;       // decimals of oracle data feed
        bool paused;                // pause a single asset
        uint depositRatio;          // minimum cratio for deposits
        uint liquidationThreshold;  // cratio at which liquidation is possible
    }

    // Pauses everything
    bool public isPaused;

    // Special addresses
    address public admin;
    address public pauser;
    address public collector;

    // Collateral currency
    address public currency; 
    uint8 public currencyDecimals;

    // C-Ratio decimals
    uint8 public cRatioDecimals = 8;

    // Fees scheme
    uint256 public fee = 50; // 0.5%
    uint256 public feeBase = 10000;
    uint256 public feeLiquidatorPercent = 500; // 5%
    uint256 public feeLiquidatorPercentBase = 10000;

    // Minimum required collateral in an oven
    uint public minCollateral;

    // List of all ovens
    mapping(address => Oven[]) public ovens;

    // List of all users addresses
    address[] public users;
    mapping(address => bool) public isUser;

    // List of available synthetic assets
    Asset[] public assets;
    
    event Close(address indexed account, uint indexed id);
    event Edit(address indexed account, uint indexed id, uint collateral, uint amount);
    event Liquidate(address indexed account, address indexed liquidator, uint indexed id, uint collateral, uint amount, uint fee);
    event Open(address indexed account, uint indexed id, uint amount, uint collateral, uint token);

    constructor(
		address _currency,
		uint8 _currencyDecimals,
        uint256 _minCollateral
    ) {
        admin = msg.sender;
        pauser = msg.sender;
        collector = msg.sender;
		currency = _currency;
		currencyDecimals = _currencyDecimals;
        minCollateral = _minCollateral;
    }

    // VIEWS
    function getUsersLength() public view returns (uint numUsers) {
        return users.length;
    }

    function getOvensLength(address account) public view returns (uint numOvens) {
        return ovens[account].length;
    }

    function getOvenRatio(address account, uint id) public view returns (uint ratio) {
        Oven memory oven = ovens[account][id];
        Asset storage asset = assets[oven.token];
        (, int price, uint startedAt, uint updatedAt, ) = IAggregatorV3(asset.oracle).latestRoundData();
        require(price > 0 && startedAt > 0 && updatedAt > 0, "Invalid oracle data");
        return 
            oven.collateral * 10**(cRatioDecimals + asset.oracleDecimals + asset.decimals - currencyDecimals)
            / (oven.amount * uint(price));
    }

    // EXTERNAL FUNCTIONS
    function open(uint collateral, uint amount, uint assetId) external {
        require(!isPaused, "All paused");
        Asset storage asset = assets[assetId];
        require(!asset.paused, "Asset paused");
        require(collateral >= minCollateral, "Not enough collateral");
        require(amount > 0, "Amount must be greater than 0");
        (, int price, uint startedAt, uint updatedAt, ) = IAggregatorV3(asset.oracle).latestRoundData();
        require(price > 0 && startedAt > 0 && updatedAt > 0, "Invalid oracle data");
        uint maxAmount =
            collateral * 10**(asset.decimals + cRatioDecimals + asset.oracleDecimals - currencyDecimals)
            / (asset.depositRatio * uint(price));
        require(amount <= maxAmount, "Mint amount too big");

        IERC20(currency).safeTransferFrom(msg.sender, address(this), collateral);
        ovens[msg.sender].push(Oven({
            account: msg.sender,
            collateral: collateral,
            amount: amount,
            token: assetId
        }));
        if (amount > 0) {
            asset.token.mint(msg.sender, amount);
        }
        if (!isUser[msg.sender]) {
            users.push(msg.sender);
            isUser[msg.sender] = true;
        }
        
        emit Open(msg.sender, ovens[msg.sender].length-1, amount, collateral, assetId);
    }
    
    function close(uint id) external {
        require(!isPaused, "All paused");
        Oven memory oven = ovens[msg.sender][id];
        require(msg.sender == oven.account, "Only issuer");
        Asset storage asset = assets[oven.token];
        require(!asset.paused, "Asset paused");
        
        if (oven.amount > 0) {
            asset.token.burn(msg.sender, oven.amount);
        }
        if (oven.collateral > 0) {
            uint collateral = oven.collateral;
            uint paidFee = collateral * fee / feeBase;
            IERC20(currency).safeTransfer(collector, paidFee);   
            IERC20(currency).safeTransfer(msg.sender, collateral - paidFee);
        }
        if (id != ovens[msg.sender].length -1) {
            ovens[msg.sender][id] = ovens[msg.sender][ovens[msg.sender].length - 1];
        }
        ovens[msg.sender].pop();

        emit Close(msg.sender, id);
    }

    function edit(uint id, uint collateral, uint amount) external {
        require(!isPaused, "All paused");
        Oven memory oven = ovens[msg.sender][id];
        require(msg.sender == oven.account, "Only issuer");
        Asset storage asset = assets[oven.token];
        require(!asset.paused, "Asset paused");
        require(collateral >= minCollateral, "Not enough collateral");
        require(amount > 0, "Amount must be >0");
        (, int price, uint startedAt, uint updatedAt, ) = IAggregatorV3(asset.oracle).latestRoundData();
        require(price > 0 && startedAt > 0 && updatedAt > 0, "Invalid oracle data");
        uint newRatio = 
            collateral * 10**(cRatioDecimals + asset.oracleDecimals + asset.decimals - currencyDecimals)
            / (amount * uint(price));
        require(newRatio >= asset.depositRatio, "New collateralization ratio too low");

        if (collateral > oven.collateral) {
            // add collateral
            IERC20(currency).safeTransferFrom(msg.sender, address(this), collateral - oven.collateral);
            oven.collateral = collateral;
        }
        else if (collateral < oven.collateral) {
            // remove collateral
            uint withdrawAmount = oven.collateral - collateral;
            uint paidFee = withdrawAmount * fee / feeBase;
            withdrawAmount -= paidFee;
            IERC20(currency).safeTransfer(collector, paidFee);
            IERC20(currency).safeTransfer(msg.sender, withdrawAmount);
            oven.collateral = collateral;
        }
        if (amount > oven.amount) {
            // mint fAsset
            asset.token.mint(msg.sender, amount - oven.amount);
            oven.amount = amount;
        }
        else if (amount < oven.amount) {
            // burn fAsset
            asset.token.burn(msg.sender, oven.amount - amount);
            oven.amount = amount;
        }

        ovens[msg.sender][id] = oven;
        emit Edit(msg.sender, id, collateral, amount);
    }
    
    function liquidate(address account, uint id, uint amount) external {
        require(!isPaused, "All paused");
        require(amount > 0, "Cant burn zero");
        Oven memory oven = ovens[account][id];
        require(oven.amount >= amount, "Amount larger than oven");
        Asset storage asset = assets[oven.token];
        require(!asset.paused, "Asset paused");
        uint cratio = getOvenRatio(account, id);
        require (cratio < asset.liquidationThreshold, "Not below liquidation threshold");
        uint collateral = oven.collateral * amount / oven.amount;
        oven.collateral = oven.collateral - collateral;
        require(oven.collateral == 0 || oven.collateral >= minCollateral, "Partial liquidation cannot go below minimum collateral");

        asset.token.burn(msg.sender, amount);
        oven.amount = oven.amount - amount;
        ovens[account][id] = oven;
        uint liquidatorReward = 
            collateral * 10**cRatioDecimals
            / cratio;
        uint paidFee = 0;
        if (liquidatorReward >= collateral) {
            // no fee in this case
            // should not happen under normal conditions
            IERC20(currency).safeTransfer(msg.sender, collateral);
        } else {
            uint left = collateral - liquidatorReward;
            uint liquidatorFee = left * feeLiquidatorPercent / feeLiquidatorPercentBase;
            left = left - liquidatorFee;
            liquidatorReward += liquidatorFee;
            uint paidFeeByLiquidator = liquidatorReward * fee / feeBase;
            liquidatorReward -= paidFeeByLiquidator;
            uint paidFeeByLiquidated = left * fee / feeBase;
            left -= paidFeeByLiquidated;
            paidFee = paidFeeByLiquidated + paidFeeByLiquidator;
            IERC20(currency).safeTransfer(collector, paidFee);
            IERC20(currency).safeTransfer(msg.sender, liquidatorReward);
            IERC20(currency).safeTransfer(oven.account, left);
        }

        emit Liquidate(oven.account, msg.sender, id, collateral, amount, paidFee);
        if (oven.collateral == 0) {
            require(oven.amount == 0, "Oven should be closing but amount is >0");
            if (id != ovens[account].length -1) {
                ovens[account][id] = ovens[account][ovens[account].length - 1];
            }
            ovens[account].pop();
            emit Close(account, id);
        }
    }

    // PAUSER FUNCTIONS
    function pause() external {
        require(msg.sender == pauser, "Pauser only");
        isPaused = true;
    }

    function unpause() external {
        require(msg.sender == pauser, "Pauser only");
        isPaused = false;
    }

    function pauseAsset(uint id) external {
        require(msg.sender == pauser, "Pauser only");
        assets[id].paused = true;
    }

    function resumeAsset(uint id) external {
        require(msg.sender == pauser, "Pauser only");
        assets[id].paused = false;
    }
    
    // ADMIN FUNCTIONS
    function setAdmin(address _admin) external {
        require(msg.sender == admin, "Admin only");
        admin = _admin;
    }
    
    function setCollector(address _collector) external {
        require(msg.sender == admin, "Admin only");
        collector = _collector;
    }

    function setPauser(address _pauser) external {
        require(msg.sender == admin, "Admin only");
        pauser = _pauser;
    }

    function setFee(uint256 _fee) external {
        require(msg.sender == admin, "Admin only");
        fee = _fee;
    }

    function setFeeLiquidation(uint256 _feeLiquidatorPercent) external {
        require(msg.sender == admin, "Admin only");
        feeLiquidatorPercent = _feeLiquidatorPercent;
    }
    
    function setMinCollateral(uint _minCollateral) external {
        require(msg.sender == admin, "Admin only");
        minCollateral = _minCollateral;
    }
    
    function setAssetOracle(address _oracle, uint id) external {
        require(msg.sender == admin, "Admin only");
        assets[id].oracle = _oracle;
        assets[id].oracleDecimals = IAggregatorV3(_oracle).decimals();
    }

    function setAssetRatios(uint _depositRatio, uint _liquidationThreshold, uint id) external {
        require(msg.sender == admin, "Admin only");
        require(_liquidationThreshold < _depositRatio, "liquidationThreshold is bigger than depositRatio");
        assets[id].depositRatio = _depositRatio;
        assets[id].liquidationThreshold = _liquidationThreshold;
    }
    
    function addAsset(IuAsset _token, address _oracle, bool _paused, uint _depositRatio, uint _liquidationThreshold) external {
        require(msg.sender == admin, "Admin only");
        require(_liquidationThreshold < _depositRatio, "liquidationThreshold is bigger than depositRatio");
        assets.push(Asset({
            token: _token,
            decimals: IuAsset(_token).decimals(),
            oracle: _oracle,
            oracleDecimals: IAggregatorV3(_oracle).decimals(),
            paused: _paused,
			depositRatio: _depositRatio,
            liquidationThreshold: _liquidationThreshold
        }));
    }
}