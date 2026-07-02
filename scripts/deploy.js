const { ethers, network } = require("hardhat");

/**
 * Deploys CHREMACOIN (CRMC).
 * NOTE: The canonical Polygon deployment already exists at
 * 0x61cA155F1660b0af117Ed00321d1c3EE264ef943.
 * This script is kept for testnets (Amoy) and reproducibility.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network : ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Factory = await ethers.getContractFactory("CHREMACOIN");
  const token = await Factory.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`CHREMACOIN deployed to: ${address}`);
  console.log(`Total supply          : ${await token.totalSupply()} (8 decimals)`);
  console.log("\nNext steps:");
  console.log(`  1. Verify:  npx hardhat verify --network ${network.name} ${address}`);
  console.log("  2. Transfer ownership to the multisig (transferOwnership)");
  console.log("  3. Register supervisor addresses (setSupervisor)");
  console.log("  4. Record tx hash & address in deployments/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
