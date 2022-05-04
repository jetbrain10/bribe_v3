// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";

interface GaugeController {
    struct VotedSlope {
        uint slope;
        uint power;
        uint end;
    }

    struct Point {
        uint bias;
        uint slope;
    }

    function vote_user_slopes(address, address) external view returns (VotedSlope memory);
    function last_user_vote(address, address) external view returns (uint);
    function points_weight(address, uint256) external view returns (Point memory);
    function checkpoint_gauge(address) external;
}

interface ve {
    function get_last_user_slope(address) external view returns (int128);
}

interface erc20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
    function balanceOf(address) external view returns (uint);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint amount) external returns (bool);
}

contract BribeV3 is Ownable {
    uint constant WEEK = 86400 * 7;
    uint constant PRECISION = 10**18;
    uint8 public feePercentage;
    address public feeAddress;
    address public distributionAddress;
    GaugeController GAUGE;
    ve VE;

    constructor(address _gaugeControllerAddress, address _veAddress, uint8 _feePercentage, address _feeAddress, address _distributionAddress){
        GAUGE = GaugeController(_gaugeControllerAddress);
        VE = ve(_veAddress);
        set_fee_percentage(_feePercentage);
        set_fee_address(_feeAddress);
        set_distribution_address(_distributionAddress);
    }

    mapping(uint => mapping(address => mapping(address => uint))) public _reward_per_gauge;

    mapping(uint => mapping(address => mapping(address => uint))) public reward_per_token;

    mapping(uint => mapping(address => address[])) public _rewards_per_gauge;
    mapping(uint => mapping(address => address[])) public _gauges_per_reward;
    mapping(uint => mapping(address => mapping(address => bool))) public _rewards_in_gauge;

    mapping(address => bool) public isBlacklisted;

    event Bribe(uint time, address indexed briber, address gauge, address reward_token, uint amount);

    function _add(uint period, address gauge, address reward) internal {
        if (!_rewards_in_gauge[period][gauge][reward]) {
            _rewards_per_gauge[period][gauge].push(reward);
            _gauges_per_reward[period][reward].push(gauge);
            _rewards_in_gauge[period][gauge][reward] = true;
        }
    }

    function rewards_per_gauge(address gauge) external view returns (address[] memory) {
        uint period = block.timestamp / WEEK * WEEK;
        return _rewards_per_gauge[period][gauge];
    }

    function gauges_per_reward(address reward) external view returns (address[] memory) {
        uint period = block.timestamp / WEEK * WEEK;
        return _gauges_per_reward[period][reward];
    }

    function _update_period(address gauge, address reward_token) internal returns (uint) {
        uint _period = block.timestamp / WEEK * WEEK;
        GAUGE.checkpoint_gauge(gauge);
        uint _slope = GAUGE.points_weight(gauge, _period).slope;
        uint _amount = _reward_per_gauge[_period][gauge][reward_token];
        reward_per_token[_period][gauge][reward_token] = _amount * PRECISION / _slope;

        return _period;
    }

    function add_reward_amount(address gauge, address reward_token, uint amount) external returns (bool) {
        uint fee = calculate_fee(amount);
        uint period = block.timestamp / WEEK * WEEK;
        amount -= fee;
        _safeTransferFrom(reward_token, msg.sender, feeAddress, fee);
        _safeTransferFrom(reward_token, msg.sender, distributionAddress, amount);
        _reward_per_gauge[period][gauge][reward_token] += amount;
        _update_period(gauge, reward_token);
        _add(period, gauge, reward_token);

        emit Bribe(block.timestamp, msg.sender, gauge, reward_token, amount);
        return true;
    }

    function tokens_for_bribe(address user, address gauge, address reward_token) external view returns (uint) {
        uint period = block.timestamp / WEEK * WEEK;
        return uint(int(VE.get_last_user_slope(user))) * reward_per_token[period][gauge][reward_token] / PRECISION;
    }

    function claimable(address user, address gauge, address reward_token) external view returns (uint) {
        if (isBlacklisted[user]) {
            return 0;
        }
        uint _period = block.timestamp / WEEK * WEEK;
        uint _amount = 0;

        uint _last_vote = GAUGE.last_user_vote(user, gauge);
        uint _vote_period = _last_vote / WEEK * WEEK;
        if (_vote_period == _period) {
            uint _slope = GAUGE.vote_user_slopes(user, gauge).slope;
            _amount = _slope * reward_per_token[_period][gauge][reward_token] / PRECISION;
        }

        return _amount;
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) =
        token.call(abi.encodeWithSelector(erc20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        (bool success, bytes memory data) =
        token.call(abi.encodeWithSelector(erc20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }

    function set_fee_percentage(uint8 _feePercentage) public onlyOwner {
        require(_feePercentage <= 15, 'Fee too high');
        feePercentage = _feePercentage;
    }

    function set_fee_address(address _feeAddress) public onlyOwner {
        feeAddress = _feeAddress;
    }

    function set_distribution_address(address _distributionAddress) public onlyOwner {
        distributionAddress = _distributionAddress;
    }

    function calculate_fee(uint amount) public view returns (uint) {
        return amount * feePercentage / 100;
    }

    function blackList(address user) public onlyOwner {
        require(!isBlacklisted[user], "user already blacklisted");
        isBlacklisted[user] = true;
    }

    function removeFromBlacklist(address user) public onlyOwner {
        require(isBlacklisted[user], "user already whitelisted");
        isBlacklisted[user] = false;
    }

}
