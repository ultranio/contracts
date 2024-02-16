const {ethers} = require("hardhat");
const hre = require("hardhat");

main()
async function main() {
  let oracle = await hre.ethers.getContractAt("MockV3Aggregator", "0x52E5A8fdF9Ffa16196f60c34b5fE8632718D6082");
  await oracle.updateAnswer("1200000000");
}
