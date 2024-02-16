const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("oracles", function () {
  let deployer
  let oracle0
  let oracle1
  let aggDivisor

  it("deploy oracle1", async function () {
    [deployer] = await ethers.getSigners(1);
    let oracleContract = await ethers.getContractFactory("MockV3Aggregator");
    oracle0 = await oracleContract.deploy(8, "132500000000"); // 1325$
    await oracle0.deployed()
  });

  it("deploy oracle2", async function () {
    let oracleContract = await ethers.getContractFactory("MockV3Aggregator");
    oracle1 = await oracleContract.deploy(18, "2000000000000000000000"); // 2000$
    await oracle1.deployed()
  });

  it("deploy AggregatorDivisor", async function () {
    let oracleContract = await ethers.getContractFactory("AggregatorDivisor");
    aggDivisor = await oracleContract.deploy(6, oracle0.address, oracle1.address);
    await aggDivisor.deployed()
    // 1325 / 2000 => .6625
    expect((await aggDivisor.latestRoundData()).answer).to.equal(ethers.BigNumber.from("662500"))
  });
});