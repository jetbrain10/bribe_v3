require('dotenv').config();
const {ethers} = require('hardhat');
const hardhat = require('hardhat');
const {MerkleTree} = require('merkletreejs');
const {BigNumber, utils} = require('ethers');
const keccak256 = require('keccak256');
const fs = require('fs');
const fsPromises = require('fs').promises;

const GAUGE_CONTROLLER_ABI = [
  {'name': 'CommitOwnership', 'inputs': [{'type': 'address', 'name': 'admin', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'name': 'ApplyOwnership', 'inputs': [{'type': 'address', 'name': 'admin', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'name': 'AddType', 'inputs': [{'type': 'string', 'name': 'name', 'indexed': false}, {'type': 'int128', 'name': 'type_id', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'name': 'NewTypeWeight', 'inputs': [{'type': 'int128', 'name': 'type_id', 'indexed': false}, {'type': 'uint256', 'name': 'time', 'indexed': false}, {'type': 'uint256', 'name': 'weight', 'indexed': false}, {'type': 'uint256', 'name': 'total_weight', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'name': 'NewGaugeWeight', 'inputs': [{'type': 'address', 'name': 'gauge_address', 'indexed': false}, {'type': 'uint256', 'name': 'time', 'indexed': false}, {'type': 'uint256', 'name': 'weight', 'indexed': false}, {'type': 'uint256', 'name': 'total_weight', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'name': 'VoteForGauge', 'inputs': [{'type': 'uint256', 'name': 'time', 'indexed': false}, {'type': 'address', 'name': 'user', 'indexed': false}, {'type': 'address', 'name': 'gauge_addr', 'indexed': false}, {'type': 'uint256', 'name': 'weight', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'name': 'NewGauge', 'inputs': [{'type': 'address', 'name': 'addr', 'indexed': false}, {'type': 'int128', 'name': 'gauge_type', 'indexed': false}, {'type': 'uint256', 'name': 'weight', 'indexed': false}], 'anonymous': false, 'type': 'event'},
  {'outputs': [], 'inputs': [{'type': 'address', 'name': '_token'}, {'type': 'address', 'name': '_voting_escrow'}], 'stateMutability': 'nonpayable', 'type': 'constructor'},
  {'name': 'commit_transfer_ownership', 'outputs': [], 'inputs': [{'type': 'address', 'name': 'addr'}], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 37597},
  {'name': 'apply_transfer_ownership', 'outputs': [], 'inputs': [], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 38497},
  {'name': 'gauge_types', 'outputs': [{'type': 'int128', 'name': ''}], 'inputs': [{'type': 'address', 'name': '_addr'}], 'stateMutability': 'view', 'type': 'function', 'gas': 1625},
  {'name': 'add_gauge', 'outputs': [], 'inputs': [{'type': 'address', 'name': 'addr'}, {'type': 'int128', 'name': 'gauge_type'}], 'stateMutability': 'nonpayable', 'type': 'function'},
  {'name': 'add_gauge', 'outputs': [], 'inputs': [{'type': 'address', 'name': 'addr'}, {'type': 'int128', 'name': 'gauge_type'}, {'type': 'uint256', 'name': 'weight'}], 'stateMutability': 'nonpayable', 'type': 'function'},
  {'name': 'checkpoint', 'outputs': [], 'inputs': [], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 18033784416},
  {'name': 'checkpoint_gauge', 'outputs': [], 'inputs': [{'type': 'address', 'name': 'addr'}], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 18087678795},
  {'name': 'gauge_relative_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'addr'}], 'stateMutability': 'view', 'type': 'function'},
  {'name': 'gauge_relative_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'addr'}, {'type': 'uint256', 'name': 'time'}], 'stateMutability': 'view', 'type': 'function'},
  {'name': 'gauge_relative_weight_write', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'addr'}], 'stateMutability': 'nonpayable', 'type': 'function'},
  {'name': 'gauge_relative_weight_write', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'addr'}, {'type': 'uint256', 'name': 'time'}], 'stateMutability': 'nonpayable', 'type': 'function'},
  {'name': 'add_type', 'outputs': [], 'inputs': [{'type': 'string', 'name': '_name'}], 'stateMutability': 'nonpayable', 'type': 'function'},
  {'name': 'add_type', 'outputs': [], 'inputs': [{'type': 'string', 'name': '_name'}, {'type': 'uint256', 'name': 'weight'}], 'stateMutability': 'nonpayable', 'type': 'function'},
  {'name': 'change_type_weight', 'outputs': [], 'inputs': [{'type': 'int128', 'name': 'type_id'}, {'type': 'uint256', 'name': 'weight'}], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 36246310050},
  {'name': 'change_gauge_weight', 'outputs': [], 'inputs': [{'type': 'address', 'name': 'addr'}, {'type': 'uint256', 'name': 'weight'}], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 36354170809},
  {'name': 'vote_for_gauge_weights', 'outputs': [], 'inputs': [{'type': 'address', 'name': '_gauge_addr'}, {'type': 'uint256', 'name': '_user_weight'}], 'stateMutability': 'nonpayable', 'type': 'function', 'gas': 18142052127},
  {'name': 'get_gauge_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'addr'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2974},
  {'name': 'get_type_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'int128', 'name': 'type_id'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2977},
  {'name': 'get_total_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 2693},
  {'name': 'get_weights_sum_per_type', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'int128', 'name': 'type_id'}], 'stateMutability': 'view', 'type': 'function', 'gas': 3109},
  {'name': 'admin', 'outputs': [{'type': 'address', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 1841},
  {'name': 'future_admin', 'outputs': [{'type': 'address', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 1871},
  {'name': 'token', 'outputs': [{'type': 'address', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 1901},
  {'name': 'voting_escrow', 'outputs': [{'type': 'address', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 1931},
  {'name': 'n_gauge_types', 'outputs': [{'type': 'int128', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 1961},
  {'name': 'n_gauges', 'outputs': [{'type': 'int128', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 1991},
  {'name': 'gauge_type_names', 'outputs': [{'type': 'string', 'name': ''}], 'inputs': [{'type': 'int128', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 8628},
  {'name': 'gauges', 'outputs': [{'type': 'address', 'name': ''}], 'inputs': [{'type': 'uint256', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2160},
  {'name': 'vote_user_slopes', 'outputs': [{'type': 'uint256', 'name': 'slope'}, {'type': 'uint256', 'name': 'power'}, {'type': 'uint256', 'name': 'end'}], 'inputs': [{'type': 'address', 'name': 'arg0'}, {'type': 'address', 'name': 'arg1'}], 'stateMutability': 'view', 'type': 'function', 'gas': 5020},
  {'name': 'vote_user_power', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2265},
  {'name': 'last_user_vote', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'arg0'}, {'type': 'address', 'name': 'arg1'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2449},
  {'name': 'points_weight', 'outputs': [{'type': 'uint256', 'name': 'bias'}, {'type': 'uint256', 'name': 'slope'}], 'inputs': [{'type': 'address', 'name': 'arg0'}, {'type': 'uint256', 'name': 'arg1'}], 'stateMutability': 'view', 'type': 'function', 'gas': 3859},
  {'name': 'time_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'address', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2355},
  {'name': 'points_sum', 'outputs': [{'type': 'uint256', 'name': 'bias'}, {'type': 'uint256', 'name': 'slope'}], 'inputs': [{'type': 'int128', 'name': 'arg0'}, {'type': 'uint256', 'name': 'arg1'}], 'stateMutability': 'view', 'type': 'function', 'gas': 3970},
  {'name': 'time_sum', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'uint256', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2370},
  {'name': 'points_total', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'uint256', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2406},
  {'name': 'time_total', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [], 'stateMutability': 'view', 'type': 'function', 'gas': 2321},
  {'name': 'points_type_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'int128', 'name': 'arg0'}, {'type': 'uint256', 'name': 'arg1'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2671},
  {'name': 'time_type_weight', 'outputs': [{'type': 'uint256', 'name': ''}], 'inputs': [{'type': 'uint256', 'name': 'arg0'}], 'stateMutability': 'view', 'type': 'function', 'gas': 2490}];
let rewards = [];

async function getRewards() {
  const bribeV2 = await ethers.getContractAt('BribeV2', process.env.BRIBEV2_ADDRESS);

  // claim bribes for each user who has voted, check claimable first
  const gaugeController = await ethers.getContractAt(GAUGE_CONTROLLER_ABI, process.env.GAUGE_CONTROLLER_ADDRESS);
  let gaugeVotesFilter = gaugeController.filters.VoteForGauge(null, null, null, null);
  let gaugeVotes = await gaugeController.queryFilter(gaugeVotesFilter, -67200);
  console.log(gaugeVotes.length);
  let filteredVotes = gaugeVotes.filter(lastWeek);
  console.log(filteredVotes.length);

  for (let i = 0; i < filteredVotes.length; i++) {
    let gaugeAddr = filteredVotes[i].args.gauge_addr;
    let rewardTokens = await bribeV2.rewards_per_gauge(gaugeAddr);
    for (let j = 0; j < rewardTokens.length; j++) {
      // check claimable
      let claimer = filteredVotes[i].args.user;
      let claimable = await bribeV2.claimable(claimer, gaugeAddr, rewardTokens[j]);
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
    const merkleJSON = generateMerkleJSON(rewards[i]);
    // update merkle tree hash in contract
    const tx = await merkleContract.updateMerkleRoot(rewards[i].token, merkleJSON.merkleRoot);
    await tx.wait();

    let newTokenUpdate = parseInt(await merkleContract.update(rewards[i].token));
    await saveToJsonFile(rewards[i].token, newTokenUpdate, merkleJSON);
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

function generateMerkleJSON(tokenRewards) {
  // generate merkle tree
  const elements = tokenRewards.amounts.map((x) =>
      utils.solidityKeccak256(['uint256', 'address', 'uint256'], [x.index, x.account, x.amount]),
  );
  // console.log(elements);
  const merkleTree = new MerkleTree(elements, keccak256, {sort: true});
  // merkleTree.print();
  const merkleRoot = merkleTree.getHexRoot();
  let reducedAmounts = tokenRewards.amounts.reduce((memo, {account, amount, index}) => {
    let proof = merkleTree.getHexProof(elements[index]);
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
