// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ComputeMarketplace {
    struct Machine {
        address provider;
        string specs; // JSON string {cpu,gpu,ram}
        uint256 pricePerHourInDuck;
        bool listed;
    }

    IERC20 public immutable duckToken;
    uint256 public nextMachineId;
    mapping(uint256 => Machine) public machines;
    uint256 public nextJobId;

    event MachineListed(uint256 indexed machineId, address indexed provider, string specs, uint256 pricePerHourInDuck);
    event MachineUnlisted(uint256 indexed machineId);
    event MachineRented(uint256 indexed machineId, address indexed renter, uint256 hoursPaid, uint256 totalPaidDuck);
    event TrainingJobCreated(
        uint256 indexed machineId,
        address indexed renter,
        uint256 indexed jobId,
        string modelId,
        string datasetId
    );

    constructor(IERC20 _duckToken) {
        duckToken = _duckToken;
    }

    function listMachine(string calldata specs, uint256 pricePerHourInDuck) external returns (uint256 machineId) {
        machineId = ++nextMachineId;
        machines[machineId] = Machine({provider: msg.sender, specs: specs, pricePerHourInDuck: pricePerHourInDuck, listed: true});
        emit MachineListed(machineId, msg.sender, specs, pricePerHourInDuck);
    }

    function unlistMachine(uint256 machineId) external {
        Machine storage m = machines[machineId];
        require(m.provider == msg.sender, "not provider");
        require(m.listed, "not listed");
        m.listed = false;
        emit MachineUnlisted(machineId);
    }

    function rentMachine(uint256 machineId, uint256 hoursPaid) external {
        Machine storage m = machines[machineId];
        require(m.listed, "not listed");
        uint256 total = m.pricePerHourInDuck * hoursPaid;
        require(duckToken.transferFrom(msg.sender, m.provider, total), "DUCK transfer failed");
        emit MachineRented(machineId, msg.sender, hoursPaid, total);
    }

    function rentMachineWithJob(
        uint256 machineId,
        uint256 hoursPaid,
        string calldata modelId,
        string calldata datasetId
    ) external returns (uint256 jobId) {
        Machine storage m = machines[machineId];
        require(m.listed, "not listed");
        uint256 total = m.pricePerHourInDuck * hoursPaid;
        require(duckToken.transferFrom(msg.sender, m.provider, total), "DUCK transfer failed");
        emit MachineRented(machineId, msg.sender, hoursPaid, total);

        jobId = ++nextJobId;
        emit TrainingJobCreated(machineId, msg.sender, jobId, modelId, datasetId);
    }
}
