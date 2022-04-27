require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-vyper");
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/Q9mwg0agBwTf8A3Zj6WQxrkaSqL5jDtB",
        // blockNumber: 14577860,
      }
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.6",
      },
      {
        version: "0.4.24",
      },
    ],
  },
  vyper: {
    version: "0.2.4",
  },
};
