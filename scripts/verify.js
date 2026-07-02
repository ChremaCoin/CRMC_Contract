const { run } = require("hardhat");

/** Verifies the deployed contract source on Polygonscan. */
const DEPLOYED = process.env.CONTRACT_ADDRESS || "0x61cA155F1660b0af117Ed00321d1c3EE264ef943";

async function main() {
  await run("verify:verify", {
    address: DEPLOYED,
    constructorArguments: [], // constructor takes no arguments
  });
  console.log(`Verified: ${DEPLOYED}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
