startMining()

async function startMining() {
  await network.provider.send("evm_setIntervalMining", [5000]);
}