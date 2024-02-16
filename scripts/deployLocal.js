const {ethers} = require("hardhat");
const hre = require("hardhat")

let deployed = {}

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

  // utils
  const multicall = await deploy("Multicall3")
  const usdb = '0x4200000000000000000000000000000000000022'
  const weth = '0x4200000000000000000000000000000000000023'

  // ultran
  const ultran = await deploy("Ultran", usdb, 18, "200000000000000000000") // 200$ minimum collateral

  // liq finder
  const liqFinder = await deploy("LiquidationFinder", ultran.address)

  // add GOLD to ultran
  const synth =  await deploy("uAsset", 'Ultran Gold 1oz', 'GOLD')
  let MINTER_ROLE = await synth.MINTER_ROLE()
  let BURNER_ROLE = await synth.BURNER_ROLE()
  await synth.grantRole(MINTER_ROLE, ultran.address)
  await synth.grantRole(BURNER_ROLE, ultran.address)
  const oracle = await deploy("MockV3Aggregator", 8, "200000000000") // 8 decimals, start price 2000$
  await ultran.addAsset(synth.address, oracle.address, false, "125000000", "120000000") // 130% min cratio, 125% liq

  // add NVDA to ultran
  const synth2 =  await deploy("uAsset", 'Ultran NVDA', 'NVDA')
  await synth2.grantRole(MINTER_ROLE, ultran.address)
  await synth2.grantRole(BURNER_ROLE, ultran.address)
  const oracle2 = await deploy("MockV3Aggregator", 8, "72600000000") // 8 decimals, start price 726$
  await ultran.addAsset(synth2.address, oracle2.address, false, "135000000", "130000000") // 130% min cratio, 125% liq

  // add AAPL to ultran
  const synth3 =  await deploy("uAsset", 'Ultran AAPL', 'AAPL')
  await synth3.grantRole(MINTER_ROLE, ultran.address)
  await synth3.grantRole(BURNER_ROLE, ultran.address)
  const oracle3 = await deploy("MockV3Aggregator", 8, "200000000000") // 8 decimals, start price 2000$
  await ultran.addAsset(synth3.address, oracle3.address, false, "135000000", "130000000") // 130% min cratio, 125% liq

  // swap
  const factory = await deploy("UniswapV2Factory", acc[0].address)
  const router = await deploy("UniswapV2Router02", factory.address, weth)
    
  console.log(deployed)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
