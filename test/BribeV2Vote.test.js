const chai = require('chai');
const {expect} = require('chai');
const {ethers} = require('hardhat');
const {solidity} = require('ethereum-waffle');

chai.use(solidity);

const fee = 10;
const project = 'CRV';

describe('BribeV2Vote ', function() {
  let initialOwner, newOwner, initialFees, fees, initialDistribution, distribution, Bribe, bribe, rewardToken, decimals;
  let voteAddress, voteId, veAddress, claimAddress, amount, feePercentage, calculatedFee;
  let rewardtokenAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'; //cUSDC

  switch (project) {
    case 'FRAX':
      voteAddress = '0xE478de485ad2fe566d49342Cbd03E49ed7DB3356';
      voteId = 159;
      claimAddress = '0xb9a708c67e2e13035a5feb0f1a2f9e3b625ebd62';
      veAddress = '0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0'; //veFXS
      break;
    case 'RBN':
      voteAddress = '0xE478de485ad2fe566d49342Cbd03E49ed7DB3356';
      voteId = 159;
      claimAddress = '0xb9a708c67e2e13035a5feb0f1a2f9e3b625ebd62';
      veAddress = '0x19854C9A5fFa8116f48f984bDF946fB9CEa9B5f7'; //veRBN
      break;
    default:
      voteAddress = '0xE478de485ad2fe566d49342Cbd03E49ed7DB3356';
      voteId = 159;
      claimAddress = '0xb9a708c67e2e13035a5feb0f1a2f9e3b625ebd62';
      veAddress = '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2'; // veCRV
      break;
  }
  before(async function() {
    [initialOwner, newOwner, initialFees, fees, initialDistribution, distribution] = await ethers.getSigners();
    if(project === "RBN"){
      Bribe = await ethers.getContractFactory('BribeV2VoteRBN');
    }else {
      Bribe = await ethers.getContractFactory('BribeV2Vote');
    }
    bribe = await Bribe.deploy(voteAddress, veAddress, fee, initialFees.address, initialDistribution.address);
    await bribe.deployed();
  });

  describe('Deployment', async function() {
    it('Should have the deployer as the owner', async function() {
      expect(await bribe.owner()).to.equal(initialOwner.address);
    });
  });

  describe('Configuration', async function() {
    it('Should return the new owner after changing it', async function() {
      const setNewOwner = await bribe.transferOwnership(newOwner.address);

      // wait until the transaction is mined
      await setNewOwner.wait();

      expect(await bribe.owner()).to.equal(newOwner.address);
    });

    it('Should return the original fee after deployment', async function() {
      expect(await bribe.feePercentage()).to.equal(fee);
    });

    it('should revert when someone other than the owner tries to change the fee', async function() {
      let newFee = 15;

      expect(bribe.set_fee_percentage(newFee)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should return the new fee once it\'s changed', async function() {
      let newFee = 15;
      const setFeeTx = await bribe.connect(newOwner).set_fee_percentage(newFee);

      // wait until the transaction is mined
      await setFeeTx.wait();

      expect(await bribe.feePercentage()).to.equal(newFee);
    });

    it('Should fail when a fee higher than 15% is set', async function() {
      let newFee = 16;
      expect(bribe.connect(newOwner).set_fee_percentage(newFee)).to.be.revertedWith('Fee too high');
    });

    it('Should return the fee address deployment', async function() {
      expect(await bribe.feeAddress()).to.equal(initialFees.address);
    });

    it('should revert when someone other than the owner tries to change the fee address', async function() {
      expect(bribe.connect(initialOwner).set_fee_address(fees.address)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should return the new fee address after changing it', async function() {
      const setNewFeeAddress = await bribe.connect(newOwner).set_fee_address(fees.address);

      // wait until the transaction is mined
      await setNewFeeAddress.wait();

      expect(await bribe.feeAddress()).to.equal(fees.address);
    });

    it('Should return the distribution address after deployment', async function() {
      expect(await bribe.distributionAddress()).to.equal(initialDistribution.address);
    });

    it('should revert when someone other than the owner tries to change the distribution address', async function() {
      expect(bribe.connect(initialOwner).set_distribution_address(distribution.address)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should return the new fee address after changing it', async function() {
      const setNewDistributionAddress = await bribe.connect(newOwner).set_distribution_address(distribution.address);

      // wait until the transaction is mined
      await setNewDistributionAddress.wait();

      expect(await bribe.distributionAddress()).to.equal(distribution.address);
    });

  });
  describe('Rewards', async function() {
    before(async function() {
      rewardToken = await ethers.getContractAt('ERC20', rewardtokenAddress);
      decimals = await rewardToken.decimals();
      amount = ethers.utils.parseUnits('100000', decimals);
      feePercentage = await bribe.feePercentage();
      calculatedFee = amount * parseInt(feePercentage) / 100;
    });
    it('Should add a reward for a vote', async function() {
      // impersonate account
      let whaleAddress = '0xb3bd459e0598dde1fe84b1d0a1430be175b5d5be';
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [whaleAddress],
      });
      const whale = await ethers.provider.getSigner(whaleAddress);
      whale.address = whale._address;

      // approve transfer of erc20 first
      let approveTX = await rewardToken.connect(whale).approve(bribe.address, amount);
      await approveTX.wait();

      let addReward = bribe.connect(whale).add_reward_amount(voteId, rewardtokenAddress, amount);
      expect(addReward).to.emit(bribe, "Bribe");
    });

    it('Should send the fee to the fee collector', async function() {

      // fees should be sent to fees address
      let feeAmount = await rewardToken.connect(fees).balanceOf(fees.address);
      expect(feeAmount).to.equal(calculatedFee);

    });
    it('Should send the reward to the distribution contract', async function() {
      // rewards should be sent to distribution
      let distributorAmount = await rewardToken.connect(distribution).balanceOf(distribution.address);
      expect(parseInt(distributorAmount)).to.equal(amount - calculatedFee);
    });

    it('Should add the reward token to the vote rewards', async function() {
      // reward token should be added to vote
      let rewardsPerVote = await bribe.rewards_per_vote(voteId);
      expect(rewardsPerVote[0]).to.equal(rewardtokenAddress);

    });
  });
  describe('Claim reward', async function() {
    it('Should have claimable rewards', async function() {

      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [claimAddress],
      });
      const claimer = await ethers.provider.getSigner(claimAddress);
      claimer.address = claimer._address;

      // let blockNumber = await ethers.provider.getBlockNumber();
      // let timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
      // console.log(timestamp);

      // blockNumber = await ethers.provider.getBlockNumber();
      // timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
      // console.log(timestamp);

      let claimable = await bribe.connect(claimer).estimate_bribe(voteId, rewardtokenAddress, claimer.address);
      // console.log(ethers.utils.formatUnits(claimable, decimals));
      expect(claimable).to.be.above(0);

    });
    it('Should claim reward', async function() {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [claimAddress],
      });
      const claimer = await ethers.provider.getSigner(claimAddress);
      claimer.address = claimer._address;

      let claimReward = bribe.claim_reward(voteId, rewardtokenAddress, claimer.address);
      expect(claimReward).to.emit(bribe, "Claim");
    });
  });
});
