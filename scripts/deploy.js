require('dotenv').config();
const {ethers} = require('hardhat');
const hardhat = require("hardhat");

async function main() {
  // get signers
  const [deployer, fees] = await ethers.getSigners();
  console.log("owner address", deployer.address);

  // deploy merkle distribution contract
  const MultiMerkleStash = await ethers.getContractFactory("MultiMerkleStash");
  const merkle = await MultiMerkleStash.deploy();

  await merkle.deployed();

  console.log("Merkle deployed to:", merkle.address);

  // deploy BribeV3
  const gaugeControllerAddress = process.env.GAUGE_CONTROLLER_ADDRESS;
  const veAddress = process.env.VE_ADDRESS;
  const feePercentage = 5;
  const feeAddress = fees.address;

  const BribeV3 = await ethers.getContractFactory("BribeV3");
  const bribeV3 = await BribeV3.deploy(gaugeControllerAddress, veAddress, feePercentage, feeAddress, merkle.address);

  await bribeV3.deployed();

  console.log("BribeV3 deployed to:", bribeV3.address);

  // deploy BribeTokensV3
  const BribeTokensV3 = await ethers.getContractFactory("BribeTokensV3");
  const bribeTokensV3 = await BribeTokensV3.deploy(gaugeControllerAddress, veAddress, bribeV3.address);

  await bribeTokensV3.deployed();

  console.log("BribeV3Tokens deployed to:", bribeTokensV3.address);

  // deploy BribeV3Vote
  const voteAddress = process.env.VOTE_ADDRESS;

  const BribeV3Vote = await ethers.getContractFactory("BribeV3Vote");
  const bribeV3Vote = await BribeV3Vote.deploy(voteAddress, veAddress, feePercentage, feeAddress, merkle.address);

  await bribeV3Vote.deployed();

  console.log("BribeV3Vote deployed to:", bribeV3Vote.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
