// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TrainingPool {
    struct Job { address requester; bytes32 modelHash; uint256 totalReward; uint256 remaining; bool active; }
    struct Submission { address contributor; bytes32 updateHash; uint96 accuracyBps; bool rewarded; }

    IERC20 public immutable duckToken;
    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => Submission[]) public submissions;

    event TrainingJobCreated(uint256 indexed jobId, address indexed requester, bytes32 modelHash, uint256 totalReward);
    event UpdateSubmitted(uint256 indexed jobId, address indexed contributor, bytes32 updateHash, uint96 accuracyBps);
    event RewardDistributed(uint256 indexed jobId, address indexed contributor, uint256 amount);

    constructor(IERC20 _duckToken) { duckToken = _duckToken; }

    function createTrainingJob(bytes32 modelHash, uint256 totalRewardPool) external returns (uint256 jobId) {
        require(totalRewardPool > 0, "reward=0");
        require(duckToken.transferFrom(msg.sender, address(this), totalRewardPool), "funding failed");
        jobId = ++nextJobId;
        jobs[jobId] = Job({requester: msg.sender, modelHash: modelHash, totalReward: totalRewardPool, remaining: totalRewardPool, active: true});
        emit TrainingJobCreated(jobId, msg.sender, modelHash, totalRewardPool);
    }

    function submitUpdate(uint256 jobId, bytes32 updateHash, uint96 accuracyBps) external {
        Job storage j = jobs[jobId];
        require(j.active, "inactive");
        require(accuracyBps <= 10000, "invalid acc");
        submissions[jobId].push(Submission({contributor: msg.sender, updateHash: updateHash, accuracyBps: accuracyBps, rewarded: false}));
        emit UpdateSubmitted(jobId, msg.sender, updateHash, accuracyBps);
    }

    function verifyProof(uint96 accuracyBps) public pure returns (bool) {
        // simplistic threshold: >= 7000 (70%)
        return accuracyBps >= 7000;
    }

    function distributeReward(uint256 jobId, uint256 submissionIdx, uint256 amount) external {
        Job storage j = jobs[jobId];
        require(msg.sender == j.requester, "only requester");
        require(j.active, "inactive");
        Submission storage s = submissions[jobId][submissionIdx];
        require(!s.rewarded, "already");
        require(verifyProof(s.accuracyBps), "bad proof");
        require(amount <= j.remaining, "exceeds pool");
        j.remaining -= amount;
        s.rewarded = true;
        require(duckToken.transfer(s.contributor, amount), "transfer failed");
        emit RewardDistributed(jobId, s.contributor, amount);
    }
}
