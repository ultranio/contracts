const {ethers} = require("hardhat");
const hre = require("hardhat");

main()
async function main() {
  let token = await hre.ethers.getContractAt("StableCoin", "0x311cFa9Fd4BA2D4D1FeCbC4489548AC287c6d36B");

  let tx = await token.approve(
    '0xA8e7F405A91998A62e0c03e6f5496755be050716',
    '0'
  )
  await tx.wait()
  console.log(tx)
}
