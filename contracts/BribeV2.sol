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

contract BribeV2 is Ownable {
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

    mapping(address => mapping(address => uint)) _claims_per_gauge;
    mapping(address => mapping(address => uint)) _reward_per_gauge;

    mapping(address => mapping(address => uint)) public reward_per_token;
    mapping(address => mapping(address => uint)) public active_period;
    mapping(address => mapping(address => mapping(address => uint))) public last_user_claim;

    mapping(address => address[]) _rewards_per_gauge;
    mapping(address => address[]) _gauges_per_reward;
    mapping(address => mapping(address => bool)) _rewards_in_gauge;

    event Bribe(uint time, address indexed briber, address gauge, address reward_token, uint amount);
    event Claim(uint time, address indexed claimer, address gauge, address reward_token, uint amount);

    function _add(address gauge, address reward) internal {
        if (!_rewards_in_gauge[gauge][reward]) {
            _rewards_per_gauge[gauge].push(reward);
            _gauges_per_reward[reward].push(gauge);
            _rewards_in_gauge[gauge][reward] = true;
        }
    }

    function rewards_per_gauge(address gauge) external view returns (address[] memory) {
        return _rewards_per_gauge[gauge];
    }

    function gauges_per_reward(address reward) external view returns (address[] memory) {
        return _gauges_per_reward[reward];
    }

    function _update_period(address gauge, address reward_token) internal returns (uint) {
        uint _period = active_period[gauge][reward_token];
        if (block.timestamp >= _period + WEEK) {
            _period = block.timestamp / WEEK * WEEK;
            GAUGE.checkpoint_gauge(gauge);
            uint _slope = GAUGE.points_weight(gauge, _period).slope;
            uint _amount = _reward_per_gauge[gauge][reward_token] - _claims_per_gauge[gauge][reward_token];
            reward_per_token[gauge][reward_token] = _amount * PRECISION / _slope;
            active_period[gauge][reward_token] = _period;
        }
        return _period;
    }

    function add_reward_amount(address gauge, address reward_token, uint amount) external returns (bool) {
        uint fee = calculate_fee(amount);
        amount -= fee;
        _safeTransferFrom(reward_token, msg.sender, feeAddress, fee);
        _safeTransferFrom(reward_token, msg.sender, distributionAddress, amount);
        _update_period(gauge, reward_token);
        _reward_per_gauge[gauge][reward_token] += amount;
        _add(gauge, reward_token);

        emit Bribe(block.timestamp, msg.sender, gauge, reward_token, amount);
        return true;
    }

    function tokens_for_bribe(address user, address gauge, address reward_token) external view returns (uint) {
        return uint(int(VE.get_last_user_slope(user))) * reward_per_token[gauge][reward_token] / PRECISION;
    }

    function claimable(address user, address gauge, address reward_token) external view returns (uint) {
        uint _period = block.timestamp / WEEK * WEEK;
        uint _amount = 0;
        if (last_user_claim[user][gauge][reward_token] < _period) {
            uint _last_vote = GAUGE.last_user_vote(user, gauge);
            if (_last_vote < _period) {
                uint _slope = GAUGE.vote_user_slopes(user, gauge).slope;
                _amount = _slope * reward_per_token[gauge][reward_token] / PRECISION;
            }
        }
        return _amount;
    }

    function claim_reward(address user, address gauge, address reward_token) external returns (uint) {
        return _claim_reward(user, gauge, reward_token);
    }

    function _claim_reward(address user, address gauge, address reward_token) internal returns (uint) {
        uint _period = _update_period(gauge, reward_token);
        uint _amount = 0;
        if (last_user_claim[user][gauge][reward_token] < _period) {
            last_user_claim[user][gauge][reward_token] = _period;
            uint _last_vote = GAUGE.last_user_vote(user, gauge);
            if (_last_vote < _period) {
                uint _slope = GAUGE.vote_user_slopes(user, gauge).slope;
                _amount = _slope * reward_per_token[gauge][reward_token] / PRECISION;
                if (_amount > 0) {
                    _claims_per_gauge[gauge][reward_token] += _amount;
                    emit Claim(block.timestamp, user, gauge, reward_token, _amount);
                }
            }
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

}
