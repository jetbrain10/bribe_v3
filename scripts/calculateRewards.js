require('dotenv').config();
const {ethers} = require('hardhat');
const hardhat = require('hardhat');
const {MerkleTree} = require('merkletreejs');
const {BigNumber, utils} = require('ethers');
const keccak256 = require('keccak256');
const fs = require('fs');
const fsPromises = require('fs').promises;
const mongoose = require('../db/connection');
const airdropSchema = require('../db/schema/airdrop')

let rewards = [];
const Airdrop = mongoose.model('Airdrop', airdropSchema);

async function getRewards() {
  const bribeV3 = await ethers.getContractAt('BribeV3', process.env.BRIBEV3_ADDRESS);

  // claim bribes for each user who has voted, check claimable first
  const gaugeController = await ethers.getContractAt("contracts/GaugeController.vy:GaugeController", process.env.GAUGE_CONTROLLER_ADDRESS);
  let gaugeVotesFilter = gaugeController.filters.VoteForGauge(null, null, null, null);
  let gaugeVotes = await gaugeController.queryFilter(gaugeVotesFilter, -67200);
  console.log(gaugeVotes.length);
  let filteredVotes = gaugeVotes.filter(lastWeek);
  console.log(filteredVotes.length);

  for (let i = 0; i < filteredVotes.length; i++) {
    let gaugeAddr = filteredVotes[i].args.gauge_addr;
    let rewardTokens = await bribeV3.rewards_per_gauge(gaugeAddr);
    for (let j = 0; j < rewardTokens.length; j++) {
      // check claimable
      let claimer = filteredVotes[i].args.user;
      let claimable = await bribeV3.claimable(claimer, gaugeAddr, rewardTokens[j]);
      // console.log(claimable);
      if (parseInt(claimable) > 0) {
        saveReward(rewardTokens[j], claimer, parseInt(claimable));
      }
    }
  }

// loop through each rewards[token]
  const merkleContract = await ethers.getContractAt('MultiMerkleStash', process.env.MERKLE_ADDRESS);
  for (let i = 0; i < rewards.length; i++) {
    // load merkle tree and see which rewards are not claimed and save the balance in balances
    let tokenUpdate = parseInt(await merkleContract.update(rewards[i].token));
    console.log(tokenUpdate);
    if (tokenUpdate > 0) {
      let previousBalances = readJsonFile(rewards[i].token, tokenUpdate);
      console.log(previousBalances);
      if (previousBalances) {
        for (let account in previousBalances.claims) {
          // check if balance is claimed, if not add it to the existing balance
          let claimed = await merkleContract.isClaimed(rewards[i].token, previousBalances.claims[account].index);
          if (!claimed) {
            let amountToBeClaimed = parseInt(previousBalances.claims[account].amount, 16);
            // Add the new rewards to the old (if they exist)
            saveReward(rewards[i].token, account, amountToBeClaimed);
          }
        }
      }
    }
    // generate merkle tree and save to file
    const merkleJSON = generateMerkleJSON(i);
    // update merkle tree hash in contract
    const tx = await merkleContract.updateMerkleRoot(rewards[i].token, merkleJSON.merkleRoot);
    await tx.wait();

    let newTokenUpdate = parseInt(await merkleContract.update(rewards[i].token));
    await saveToJsonFile(rewards[i].token, newTokenUpdate, merkleJSON);

    // save to db
    let airdrop = new Airdrop({token: rewards[i].token, update: newTokenUpdate, merkleRoot: merkleJSON.merkleRoot, claims: rewards[i].amounts});
    await airdrop.save();
  }
}

function lastWeek(event) {
  let date = new Date();
  // go back 1 week
  date.setDate(date.getDate() - 7);
  return parseInt(event.args.time) >= parseInt(Date.parse(date) / 1000);
}

function saveReward(token, account, amount) {
  if (amount > 0) {
    let existingToken = rewards.find(x => x.token === token);
    if (existingToken) {
      let existingHolder = existingToken.amounts.find(x => x.account === account);
      if (existingHolder) {
        rewards[rewards.indexOf(existingToken)].amounts[existingToken.amounts.indexOf(existingHolder)].amount = existingHolder.amount + amount;
      } else {
        rewards[rewards.indexOf(existingToken)].amounts.push({index: rewards[rewards.indexOf(existingToken)].amounts.length, account, amount});
      }
    } else {
      rewards.push({token, amounts: [{index: 0, account, amount}]});
    }
  }
}

function generateMerkleJSON(rewardsIndex) {
  // generate merkle tree
  const elements = rewards[rewardsIndex].amounts.map((x) =>
      utils.solidityKeccak256(['uint256', 'address', 'uint256'], [x.index, x.account, x.amount]),
  );
  // console.log(elements);
  const merkleTree = new MerkleTree(elements, keccak256, {sort: true});
  // merkleTree.print();
  const merkleRoot = merkleTree.getHexRoot();
  let reducedAmounts = rewards[rewardsIndex].amounts.reduce((memo, {account, amount, index}) => {
    let proof = merkleTree.getHexProof(elements[index]);

    // also save the proof so we can easily put it in the db later
    rewards[rewardsIndex].amounts[index].proof = proof;
    memo[account] = {amount: BigNumber.from(amount).toHexString(), index, proof};
    return memo;
  }, {});
  const json = {merkleRoot, claims: reducedAmounts};
  // console.log(merkleRoot);

  return json;
}

async function saveToJsonFile(token, version, json) {
  let versionString = String(version).padStart(4, '0');
  try {
    await fsPromises.mkdir('merkle/' + token, {recursive: true});
    await fsPromises.writeFile('merkle/' + token + '/' + versionString + '.json', JSON.stringify(json, null, 2));
    console.log('merkle/' + token + '/' + versionString + '.json created');
  } catch (err) {
    console.log(err);
  }
}

function readJsonFile(token, version) {
  try {
    let versionString = String(version).padStart(4, '0');
    let json = fs.readFileSync('merkle/' + token + '/' + versionString + '.json');
    if (json) {
      return JSON.parse(json);
    } else {
      return null;
    }
  } catch (e) {
    console.log(e);
    return null;
  }
}

getRewards()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
