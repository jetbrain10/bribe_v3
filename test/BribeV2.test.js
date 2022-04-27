const chai = require('chai');
const {expect} = require('chai');
const {ethers} = require('hardhat');
const {solidity} = require('ethereum-waffle');

chai.use(solidity);

const fee = 10;
const project = 'CRV';

describe('BribeV2 ', function() {
  let initialOwner, newOwner, initialFees, fees, initialDistribution, distribution, Bribe, bribe, rewardToken, decimals;
  let gaugeControllerAddress, gaugeAddress, veAddress, claimAddress, amount, feePercentage, calculatedFee;
  let rewardtokenAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'; //cUSDC

  switch (project) {
    case 'FRAX':
      gaugeControllerAddress = '0x3669C421b77340B2979d1A00a792CC2ee0FcE737';
      gaugeAddress = '0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16';
      claimAddress = '0xf69ea6646cf682262e84cd7c67133eac59cef07b';
      veAddress = '0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0'; //veFXS
      break;
    case 'RBN':
      gaugeControllerAddress = '0x0cb9cc35cEFa5622E8d25aF36dD56DE142eF6415';
      gaugeAddress = '';
      claimAddress = '';
      veAddress = '0x19854C9A5fFa8116f48f984bDF946fB9CEa9B5f7';
      break;
    default:
      gaugeControllerAddress = '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB';
      gaugeAddress = '0x903dA6213a5A12B61c821598154EfAd98C3B20E4';
      claimAddress = '0xd2357fffbcdc3780835ceff1447c357c413ddd65';
      veAddress = '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2'; // veCRV
      break;
  }
  before(async function() {
    [initialOwner, newOwner, initialFees, fees, initialDistribution, distribution] = await ethers.getSigners();
    Bribe = await ethers.getContractFactory('BribeV2');
    bribe = await Bribe.deploy(gaugeControllerAddress, veAddress, fee, initialFees.address, initialDistribution.address);
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
    it('Should add a reward for a gauge', async function() {
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

      let addReward = bribe.connect(whale).add_reward_amount(gaugeAddress, rewardtokenAddress, amount);
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

      // _reward_per_gauge should be equal to amount - fee

    it('Should add the reward token to the gauge rewards', async function() {
      // reward token should be added to gauge
      let rewardsPerGauge = await bribe.rewards_per_gauge(gaugeAddress);
      expect(rewardsPerGauge[0]).to.equal(rewardtokenAddress);

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

      let claimAmount = await bribe.connect(claimer).tokens_for_bribe(claimer.address, gaugeAddress, rewardtokenAddress);
      // console.log(ethers.utils.formatUnits(claimAmount, decimals));
      expect(claimAmount).to.be.above(0);

      // let blockNumber = await ethers.provider.getBlockNumber();
      // let timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
      // console.log(timestamp);

      // blockNumber = await ethers.provider.getBlockNumber();
      // timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
      // console.log(timestamp);

      let claimable = await bribe.connect(claimer).claimable(claimer.address, gaugeAddress, rewardtokenAddress);
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

      let claimReward = bribe.claim_reward(claimer.address, gaugeAddress, rewardtokenAddress);
       expect(claimReward).to.emit(bribe, "Claim");
    });
  });
});
