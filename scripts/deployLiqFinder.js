const {ethers} = require("hardhat");
const hre = require("hardhat")

let deployed = {}
let ultranAddr = '0x4938D2016e7446a24b07635611bD34289Df42ECb'

async function deploy(name, ...args) {
  const C = await ethers.getContractFactory(name);
  const c = await C.deploy(...args)
  await c.deployed()
  console.log(`deploy ${name}`, c.address)
  deployed[name] = c.address;
  return c
}

async function main() {
  const acc = await ethers.getSigners()
  console.log('Deployer: '+acc[0].address)

  const finder = await deploy("LiquidationFinder", ultranAddr)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
