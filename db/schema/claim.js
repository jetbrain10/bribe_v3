const mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  account: String,
  amount: Number,
  index: Number,
  proof: [String],
});
