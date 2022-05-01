require('dotenv').config();
const {ethers} = require('hardhat');
const hardhat = require('hardhat');

// for test purposes only!

async function addRewards(){
  await addReward("0xb3bd459e0598dde1fe84b1d0a1430be175b5d5be", "0x39AA39c021dfbaE8faC545936693aC917d5E7563", "0x903dA6213a5A12B61c821598154EfAd98C3B20E4"); //cUSDC

  await addReward("0xb3bd459e0598dde1fe84b1d0a1430be175b5d5be", "0xE1Be5D3f34e89dE342Ee97E6e90D405884dA6c67", "0xd0698b2E41C42bcE42B51f977F962Fd127cF82eA"); //TRX

}

async function addReward(whaleAddress, rewardtokenAddress, gaugeAddress) {
  const bribeV3 = await ethers.getContractAt('BribeV3', process.env.BRIBEV3_ADDRESS);
  //add a reward for testing
  // impersonate account
  let rewardToken = await ethers.getContractAt('ERC20', rewardtokenAddress);
  let decimals = await rewardToken.decimals();
  let amount = ethers.utils.parseUnits('100000', decimals);
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [whaleAddress],
  });
  const whale = await ethers.provider.getSigner(whaleAddress);
  whale.address = whale._address;

  // approve transfer of erc20 first
  let approveTX = await rewardToken.connect(whale).approve(bribeV3.address, amount);
  await approveTX.wait();

  let addReward = await bribeV3.connect(whale).add_reward_amount(gaugeAddress, rewardtokenAddress, amount);
  await addReward.wait();
}

addRewards()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
