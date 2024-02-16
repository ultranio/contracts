const {ethers} = require("hardhat");
const hre = require("hardhat")

let deployed = {}
let ultranAddr = "0x4938D2016e7446a24b07635611bD34289Df42ECb"
let assetName = "TSLA Stock"
let assetSymbol = "TSLA"
// let depositRatio = "150000000"
// let liqThreshold = "145000000"
// let divisorDecimals = 8
// let oracle0 = "0x3dD6e51CB9caE717d5a8778CF79A04029f9cFDF8"
// let oracle1 = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3" // usdc/usd
// let oracleAddr = "0xA456b885F40a4f0496fE8e94EDcceeBB2e32C67F"

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

  let ultran = await hre.ethers.getContractAt("Forge", ultranAddr);
  const synth =  await deploy("ForgeAsset", assetName, assetSymbol)
  let MINTER_ROLE = await synth.MINTER_ROLE()
  let BURNER_ROLE = await synth.BURNER_ROLE()
  await synth.grantRole(MINTER_ROLE, ultran.address)
  await synth.grantRole(BURNER_ROLE, ultran.address)

  // let divisor = await deploy("AggregatorDivisor", divisorDecimals, oracle0, oracle1)
  //await ultran.addAsset(synth.address, oracleAddr, false, depositRatio, liqThreshold)

  console.log(deployed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
