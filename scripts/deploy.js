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

  // deploy BribeV2
  const gaugeControllerAddress = process.env.GAUGE_CONTROLLER_ADDRESS;
  const veAddress = process.env.VE_ADDRESS;
  const feePercentage = 5;
  const feeAddress = fees.address;

  const BribeV2 = await ethers.getContractFactory("BribeV2");
  const bribeV2 = await BribeV2.deploy(gaugeControllerAddress, veAddress, feePercentage, feeAddress, merkle.address);

  await bribeV2.deployed();

  console.log("BribeV2 deployed to:", bribeV2.address);

  // deploy BribeTokensV2
  const BribeTokensV2 = await ethers.getContractFactory("BribeTokensV2");
  const bribeTokensV2 = await BribeTokensV2.deploy(gaugeControllerAddress, veAddress, bribeV2.address);

  await bribeTokensV2.deployed();

  console.log("BribeV2Tokens deployed to:", bribeTokensV2.address);

  // deploy BribeV2Vote
  const voteAddress = process.env.VOTE_ADDRESS;

  const BribeV2Vote = await ethers.getContractFactory("BribeV2Vote");
  const bribeV2Vote = await BribeV2Vote.deploy(voteAddress, veAddress, feePercentage, feeAddress, merkle.address);

  await bribeV2Vote.deployed();

  console.log("BribeV2Vote deployed to:", bribeV2Vote.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
