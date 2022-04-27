require('dotenv').config();
const {ApolloServer, gql} = require('apollo-server');
const mongoose = require('./db/connection');
const airdropSchema = require('./db/schema/airdrop');
const {ethers} = require('hardhat');

const Airdrop = mongoose.model('Airdrop', airdropSchema);
const provider = new ethers.providers.JsonRpcProvider(process.env.WEB3_PROVIDER);
const signer = provider.getSigner();

const typeDefs = gql`

    type Claim{
        token: String
        index: Int
        amount: String
        merkleProof: [String]
    }

    type Query {
        claims(account: String!): [Claim]
    }
`;

const resolvers = {
  Query: {
    claims: async (parent, args, context, info) => {
      const merkleContract = await ethers.getContractAt('MultiMerkleStash', process.env.MERKLE_ADDRESS, signer);
      let claims = [];
      // get latest merkle root where account has a balance for each token
      let tokens = await Airdrop.aggregate(
          [
            {'$match': {'claims.account': args.account}},
            {
              '$group': {
                '_id': '$token',
                'update': {'$max': '$update'},
              },
            },
          ]);
      for (let i = 0; i < tokens.length; i++) {
        let token = await Airdrop.findOne({token: tokens[i]._id, update: tokens[i].update});
        let reward = token.claims.find((item) => item.account === args.account);
        // check if reward has already been claimed
        let claimed = await merkleContract.isClaimed(tokens[i]._id, reward.index);
        if (!claimed) {
          claims.push({token: tokens[i]._id, index: reward.index, amount: reward.amount, merkleProof: reward.proof});
        }
      }
      console.log(claims);
      return claims;
    },
  },
};

const server = new ApolloServer({typeDefs, resolvers});

// The `listen` method launches a web server.
server.listen().then(({url}) => {
  console.log(`🚀  Server ready at ${url}`);
});
