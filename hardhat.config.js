require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
// Optional: compile with npm-installed solc (works in offline/CI environments)
try { require("./hardhat.local-solc"); } catch (e) {}

/**
 * CHREMACOIN (CRMC) — Hardhat configuration
 *
 * Compiler settings match the verified on-chain deployment on Polygon:
 *   Contract : 0x61cA155F1660b0af117Ed00321d1c3EE264ef943
 *   Solidity : 0.8.20
 *   Optimizer: enabled, 200 runs   // TODO: confirm against Polygonscan "Contract" tab
 */

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts", // legacy/ (Solidity 0.4.24, archived) is intentionally excluded
  },
  networks: {
    hardhat: {},
    polygon: {
      url: POLYGON_RPC,
      chainId: 137,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      polygon: POLYGONSCAN_API_KEY,
      polygonAmoy: POLYGONSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
