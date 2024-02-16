const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ultran", function () {
  let oracleDecimals = 18
  let MAX_UINT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
  let ONE = "1000000";
  let ONE_THOUSAND = "1000000000";
  let ONE_MILL = "1000000000000";
  let ONE_BILL = "1000000000000000";
  let deployer;
  let user1;
  let user2;
  let ultran;
  let stable;
  let synth;
  let oracle;
  let MINTER_ROLE;
  let BURNER_ROLE;
  
  it("deploy StableCoin", async function () {
    [deployer, user1, user2] = await ethers.getSigners(3);
    let stableContract = await ethers.getContractFactory("StableCoin");
    stable = await stableContract.deploy('USDX', 'USDX');
    await stable.deployed();
    expect(await stable.totalSupply()).to.equal(ethers.BigNumber.from("0"))
  });

  it("mint StableCoin 3x", async function () {
    await stable.mint(deployer.address, ethers.BigNumber.from(ONE_MILL));
    await stable.mint(user1.address, ethers.BigNumber.from(ONE_MILL));
    await stable.mint(user2.address, ethers.BigNumber.from(ONE_MILL));
    expect(await stable.totalSupply()).to.equal(ethers.BigNumber.from("3000000000000"))
  });

  it("deploy Forge", async function () {
    let ultranContract = await ethers.getContractFactory("Forge");
    ultran = await ultranContract.deploy(stable.address, await stable.decimals(), "200000000"); // 200$ min collateral
    await ultran.deployed();
  });

  it("deploy ForgeAsset", async function () {
    let minCratio = "130000000" // min 130% collaterization
    let liqCratio = "120000000" // liq @ 120% collaterization
    let oraclePrice = "10000000000000000000" // 10$
    let synthContract = await ethers.getContractFactory("ForgeAsset");
    synth = await synthContract.deploy('Synthetic Gold', 'sXAU');
    expect(await synth.totalSupply()).to.equal(ethers.BigNumber.from("0"))
    let oracleContract = await ethers.getContractFactory("MockV3Aggregator");
    oracle = await oracleContract.deploy(oracleDecimals, oraclePrice);
    await ultran.addAsset(synth.address, oracle.address, false, minCratio, liqCratio);
    await synth.deployed();
    MINTER_ROLE = await synth.MINTER_ROLE()
    BURNER_ROLE = await synth.BURNER_ROLE()
    await synth.grantRole(MINTER_ROLE, ultran.address)
    await synth.grantRole(BURNER_ROLE, ultran.address)
  });

  it("deployer open oven", async function () {
    await stable.approve(ultran.address, MAX_UINT);
    let deposit = BigInt(ONE_THOUSAND) // 1K
    let cratio = 200000000 // 200% collaterization
    let power = 8+18-6-1 // cratio dec + synth dec - usdc dec - 1 for price
    let wanted = deposit * BigInt(10**power) / BigInt(cratio);
    await ultran.open(deposit, wanted, 0)
    expect(await stable.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from("999000000000"))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from(ONE_THOUSAND))
    expect(await synth.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await synth.totalSupply()).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await ultran.getOvensLength(deployer.address)).to.equal(ethers.BigNumber.from("1"))
  })

  it("deployer close oven", async function () {
    await ultran.close(0)
    expect(await ultran.getOvensLength(deployer.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await stable.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from(ONE_MILL))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await synth.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from("0"))
  })

  it("user1 open oven", async function () {
    await stable.connect(user1).approve(ultran.address, MAX_UINT);
    let deposit = BigInt(ONE_THOUSAND) // 1K
    let cratio = 200000000 // 200% collaterization
    let power = 8+18-6-1 // cratio dec + synth dec - usdc dec - 1 for price
    let wanted = deposit * BigInt(10**power) / BigInt(cratio);
    await ultran.connect(user1).open(deposit, wanted, 0)
    expect(await stable.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("999000000000"))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from(ONE_THOUSAND))
    expect(await synth.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await synth.totalSupply()).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await ultran.getOvensLength(user1.address)).to.equal(ethers.BigNumber.from("1"))
  })

  it("user1 close oven", async function () {
    await ultran.connect(user1).close(0)
    expect(await ultran.getOvensLength(user1.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await stable.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("999999000000"))
    expect(await stable.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from("1000001000000"))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await synth.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("0"))
  })

  it("user2 fail open oven", async function () {
    await stable.connect(user2).approve(ultran.address, MAX_UINT);
    let deposit = BigInt(ONE_THOUSAND) // 1K
    let wanted = "76923076923100000000"
    await expect(ultran.connect(user2).open(deposit, wanted, 0)).to.be.reverted // mint amount too big
  })

  it("equalize balances", async function () {
    await stable.transfer(user1.address, ONE)
    expect(await stable.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from("1000000000000"))
    expect(await stable.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("1000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("1000000000000"))
  })

  it("zero fees", async function () {
    await ultran.setFee(0);
    expect (await ultran.fee()).to.equal(ethers.BigNumber.from("0"))
  })

  it("user2 open oven", async function () {
    let deposit = BigInt(ONE_THOUSAND) // 1K
    let cratio = 200000000 // 200% collaterization
    let power = 8+18-6-1 // cratio dec + synth dec - usdc dec - 1 for price
    let wanted = deposit * BigInt(10**power) / BigInt(cratio);
    await ultran.connect(user2).open(deposit, wanted, 0)
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999000000000"))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from(ONE_THOUSAND))
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await synth.totalSupply()).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await ultran.getOvensLength(user2.address)).to.equal(ethers.BigNumber.from("1"))
  })

  it("user2 deposit", async function () {
    let oven = await ultran.connect(user2).ovens(user2.address, 0);
    let addedCollateral = oven.collateral.add(ethers.BigNumber.from(ONE_THOUSAND))
    await ultran.connect(user2).edit(0, addedCollateral, oven.amount) // deposit 1K
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("998000000000"))
  })

  it("user2 withdraw", async function () {
    let oven = await ultran.connect(user2).ovens(user2.address, 0);
    let removedCollateral = oven.collateral.sub(ethers.BigNumber.from(ONE_THOUSAND))
    await ultran.connect(user2).edit(0, removedCollateral, oven.amount) // withdraw 1K
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999000000000"))
  })

  it("user2 burn", async function () {
    let oven = await ultran.connect(user2).ovens(user2.address, 0);
    let removedAsset = oven.amount.sub(ethers.BigNumber.from("10000000000000000000"))
    await ultran.connect(user2).edit(0, oven.collateral, removedAsset) // burn 10 XAU
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("40000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999000000000"))
  })

  it("user2 mint", async function () {
    let oven = await ultran.connect(user2).ovens(user2.address, 0);
    let addedAsset = oven.amount.add(ethers.BigNumber.from("10000000000000000000"))
    await ultran.connect(user2).edit(0, oven.collateral, addedAsset) // mint 10 XAU
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999000000000"))
    expect(await ultran.getOvenRatio(user2.address,0)).to.equal(ethers.BigNumber.from("200000000"))
  })

  it("oracle change price", async function () {
    await oracle.updateAnswer("11000000000000000000");
    expect(await ultran.getOvenRatio(user2.address,0)).to.equal(ethers.BigNumber.from("181818181"))
    await oracle.updateAnswer("12000000000000000000");
    expect(await ultran.getOvenRatio(user2.address,0)).to.equal(ethers.BigNumber.from("166666666"))
    await oracle.updateAnswer("15000000000000000000");
    expect(await ultran.getOvenRatio(user2.address,0)).to.equal(ethers.BigNumber.from("133333333"))
    await oracle.updateAnswer("16000000000000000000");
    expect(await ultran.getOvenRatio(user2.address,0)).to.equal(ethers.BigNumber.from("125000000"))
  })

  it("fail liquidate", async function () {
    await expect(ultran.connect(user1).liquidate(user2.address, 0, "50000000000000000000")).to.be.reverted // user1 not enough XAU
    await synth.connect(user2).transfer(user1.address, "50000000000000000000")
    expect(await synth.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("0"))
    await expect(ultran.connect(user1).liquidate(user2.address, 0, "50000000000000000000")).to.be.reverted // c-ratio too high
    await oracle.updateAnswer("17000000000000000000");
    expect(await ultran.getOvenRatio(user2.address,0)).to.equal(ethers.BigNumber.from("117647058"))
    await expect(ultran.connect(user1).liquidate(user2.address, 0, "49000000000000000000")).to.be.reverted // oven cant go below min collateral
  })

  it("partial liquidation", async function () {
    await ultran.connect(user1).liquidate(user2.address, 0, "25000000000000000000")
    expect(await synth.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("25000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999071249999"))
    expect(await stable.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("1000428750001"))
  })

  it("full liquidation", async function () {
    await ultran.connect(user1).liquidate(user2.address, 0, "25000000000000000000") 
    expect(await synth.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999142499998"))
    expect(await stable.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("1000857500002"))
    expect(await ultran.getOvensLength(user2.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from("0"))
    expect(await synth.totalSupply()).to.equal(ethers.BigNumber.from("0"))
  })

  it("equalize balances", async function () {
    await stable.connect(user1).transfer(user2.address, "857500002")
    expect(await stable.balanceOf(deployer.address)).to.equal(ethers.BigNumber.from("1000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("1000000000000"))
    expect(await stable.balanceOf(user1.address)).to.equal(ethers.BigNumber.from("1000000000000"))
  })

  it("user2 open again", async function () {
    await oracle.updateAnswer("10000000000000000000");
    let deposit = BigInt(ONE_THOUSAND) // 1K
    let cratio = 200000000 // 200% collaterization
    let power = 8+18-6-1 // cratio dec + synth dec - usdc dec - 1 for price
    let wanted = deposit * BigInt(10**power) / BigInt(cratio);
    await ultran.connect(user2).open(deposit, wanted, 0)
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999000000000"))
    expect(await stable.balanceOf(ultran.address)).to.equal(ethers.BigNumber.from(ONE_THOUSAND))
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await synth.totalSupply()).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await ultran.getOvensLength(user2.address)).to.equal(ethers.BigNumber.from("1"))
  })

  it("user2 deposit & mint", async function () {
    let oven = await ultran.connect(user2).ovens(user2.address, 0);
    let addedCollateral = oven.collateral.add(ethers.BigNumber.from(ONE_THOUSAND))
    let addedAsset = oven.amount.add(ethers.BigNumber.from("50000000000000000000"))
    await ultran.connect(user2).edit(0, addedCollateral, addedAsset) // deposit 1K and mint 50 XAU
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("100000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("998000000000"))
  })

  it("user2 withdraw & burn", async function () {
    let oven = await ultran.connect(user2).ovens(user2.address, 0);
    let removedCollateral = oven.collateral.sub(ethers.BigNumber.from(ONE_THOUSAND))
    let removedAsset = oven.amount.sub(ethers.BigNumber.from("50000000000000000000"))
    await ultran.connect(user2).edit(0, removedCollateral, removedAsset) // withdraw 1K and burn 50 XAU
    expect(await synth.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("50000000000000000000"))
    expect(await stable.balanceOf(user2.address)).to.equal(ethers.BigNumber.from("999000000000"))
  })
  return
});