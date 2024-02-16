startMining()

async function startMining() {
  await network.provider.send("evm_increaseTime", [60*60*24*7]);
}