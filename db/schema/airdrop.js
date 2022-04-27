const mongoose = require('mongoose');
const claim = require("./claim");

module.exports = new mongoose.Schema({
  token: String,
  update: Number,
  claims: [claim],
  merkleRoot: String
})
