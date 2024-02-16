const {ethers} = require("hardhat");
const hre = require("hardhat");

main()
async function main() {
  let ve = await hre.ethers.getContractAt("RewardsDistributor", "0x68B1D87F95878fE05B998F19b66F4baba5De1aed");
  
  let tx = await ve.claim(2)
  await tx.wait()
}


