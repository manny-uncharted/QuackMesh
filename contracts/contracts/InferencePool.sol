// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract InferencePool {
    struct Job { address requester; uint256 totalBudget; uint256 remaining; bool active; }

    IERC20 public immutable duckToken;
    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    event InferenceJobCreated(uint256 indexed jobId, address indexed requester, uint256 totalBudget);
    event InferencePaid(uint256 indexed jobId, address indexed provider, uint256 amount);

    constructor(IERC20 _duckToken) { duckToken = _duckToken; }

    function createInferenceJob(uint256 totalBudget) external returns (uint256 jobId) {
        require(totalBudget > 0, "budget=0");
        require(duckToken.transferFrom(msg.sender, address(this), totalBudget), "funding failed");
        jobId = ++nextJobId;
        jobs[jobId] = Job({requester: msg.sender, totalBudget: totalBudget, remaining: totalBudget, active: true});
        emit InferenceJobCreated(jobId, msg.sender, totalBudget);
    }

    function payProvider(uint256 jobId, address provider, uint256 amount) external {
        Job storage j = jobs[jobId];
        require(msg.sender == j.requester, "only requester");
        require(j.active, "inactive");
        require(amount <= j.remaining, "exceeds budget");
        j.remaining -= amount;
        require(duckToken.transfer(provider, amount), "transfer failed");
        emit InferencePaid(jobId, provider, amount);
    }
}
