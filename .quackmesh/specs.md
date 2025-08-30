## **The Master Build Prompt for QuackMesh**

**Role:** You are a senior full-stack developer and DevOps engineer specializing in decentralized systems, machine learning, and cloud infrastructure. You are building a production-ready prototype, not a simulation.

**Project Name:** QuackMesh

**Core Objective:** Build a fully functional, decentralized federated learning platform where:
1.  **Data Owners (Contributors)** can contribute compute power and data to train models without exposing raw data, earning $DUCK tokens.
2.  **Compute Providers** can rent out their machines (CPU/GPU) for both training and inference tasks, earning $DUCK tokens per hour of usage.
3.  **AI Requesters** can pay $DUCK tokens to have a model trained on a distributed dataset or to run distributed inference.
4.  The system must support forming **ad-hoc clusters** of rented machines for large-scale parallel training or inference.

**Mandatory Requirements:**
*   **NO SIMULATIONS.** Use real code, real smart contracts, real model training.
*   **Use DuckChain.** Implement the incentive layer with solidity smart contracts on a testnet, using the official DuckChain SDK and $DUCK token.
*   **Use AWS.** Use the provided credits. Use EC2 for the orchestrator and SageMaker for any heavy central ML lifting if needed.
*   **Full Compute Rental:** The system must include a marketplace for listing and renting compute resources.
*   **Cluster Support:** The orchestrator must be able to group rented machines into a cluster for a job.

**Tech Stack:**
*   **Blockchain:** Solidity, Hardhat/Truffle, DuckChain SDK, Ethers.js
*   **Backend (Orchestrator):** Node.js/Express or Python/FastAPI
*   **ML Framework:** PyTorch (preferred) or TensorFlow with Flower framework for federated learning.
*   **Compute Client:** Python application running on contributor/provider machines.
*   **Infrastructure:** Docker, Docker Compose (for local testing), AWS EC2, AWS SageMaker, PostgreSQL/Redis on AWS (RDS/ElastiCache)
*   **Frontend (Optional for Demo):** React/Next.js with ethers.js to interact with contracts.

---

### **Architecture & Component Breakdown**

Build the following components in sequence:

**1. Smart Contracts (DuckChain Incentive Layer)**
*   **`ComputeMarketplace.sol`**: Allows compute providers to `listMachine(specs, pricePerHourInDuck)`, `unlistMachine`, and AI requesters to `rentMachine(machineId, hours)` by paying the $DUCK cost. Emits `MachineListed`, `MachineRented` events.
*   **`TrainingPool.sol`**: AI requesters `createTrainingJob(modelHash, totalRewardPool)` by depositing $DUCK. Contributors `submitUpdate(jobId, updateHash, validationAccuracy)` after training. Includes a `verifyProof` function (could be a simple accuracy threshold check, e.g., > 70% to prevent spam). Successful submissions trigger `rewardDistributed(contributor, amount)`.
*   **`InferencePool.sol`**: Similar to TrainingPool but for inference jobs. Requesters pay for compute time on a cluster of rented machines.

**2. Federated Learning Orchestrator (AWS EC2 Instance)**
*   **REST API Endpoints:**
    *   `POST /api/job` - For a requester to initiate a new training job (model architecture, initial weights, validation dataset).
    *   `GET /api/job/:jobId/model` - For clients to get the latest global model.
    *   `POST /api/job/:jobId/update` - For clients to submit their model updates (weights/gradients).
    *   `GET /api/cluster/:jobId` - Returns a list of IPs/ports for machines rented for a specific job to form a cluster.
*   **Core Logic:**
    *   Manages the lifecycle of training jobs.
    *   Integrates with the DuckChain SDK to listen for `TrainingPool.TrainingJobCreated` events to start a job.
    *   Implements Federated Averaging (FedAvg) algorithm to aggregate model updates from clients.
    *   Communicates with the **Cluster Manager** to provision and manage rented machines from the `ComputeMarketplace` for larger jobs.

**3. Cluster Manager (Submodule of Orchestrator)**
*   When a job requires more than one machine, this module:
    1.  Calls `ComputeMarketplace.sol` to rent `N` machines.
    2.  Gets connection details for each rented machine.
    3.  Uses SSH or a Docker API to deploy and configure the training client on each machine.
    4.  Provides the cluster configuration to the Orchestrator for distributed training coordination.

**4. QuackMesh Client (Python Application)**
*   Runs on the machines of Data Contributors and Compute Providers.
*   **Two Modes:**
    *   **Contributor Mode:** Downloads the global model from the orchestrator, trains it on local data, validates it, and submits the update back to the orchestrator and the proof to the `TrainingPool` contract to claim its reward.
    *   **Provider Mode:** Registers the machine's specs (CPU, GPU, RAM) with the `ComputeMarketplace.sol` contract and waits to be rented. When rented, it starts a **Training Worker** process that listens for tasks from the Orchestrator's cluster manager.

**5. Demo Application & Testing Scripts**
*   **`/scripts`** directory with scripts to:
    *   Deploy all contracts to DuckChain testnet.
    *   Seed a local PostgreSQL DB on the orchestrator with a sample job.
    *   Register a few simulated compute providers.
    *   Run multiple client instances in contributor mode to simulate federated learning.
*   A simple dashboard (React) that shows:
    *   Global model accuracy improving over rounds.
    *   Listings in the ComputeMarketplace.
    *   Transactions on the smart contracts.

---

### **Step-by-Step Implementation Plan for the AI**

**Phase 1: Foundation & Smart Contracts (Days 1-2)**
1.  Set up a Hardhat project configured for the DuckChain testnet.
2.  Write and compile `ComputeMarketplace.sol`, `TrainingPool.sol`, and `InferencePool.sol`.
3.  Write deployment scripts for the contracts.
4.  Deploy contracts to DuckChain testnet and save the addresses to a config file.
5.  Write basic tests for the contracts (e.g., listing a machine, renting it, creating a job, submitting an update).

**Phase 2: The Orchestrator & Cluster Manager (AWS - Days 3-4)**
1.  Provision an AWS EC2 instance (Ubuntu Server 22.04 LTS).
2.  Initialize a Node.js/Python project on the EC2 instance.
3.  Build the REST API with the endpoints defined above.
4.  Implement the FedAvg logic in a service file.
5.  Build the Cluster Manager module with SSH capabilities to manage rented nodes.
6.  Integrate the DuckChain SDK to listen to contract events.
7.  Set up a PostgreSQL database on AWS RDS to store job and client data.

**Phase 3: The QuackMesh Client (Day 5)**
1.  Create a Python project using Poetry or Pipenv.
2.  Implement the CLI for the two modes (`--contributor`, `--provider`).
3.  Implement the training logic using PyTorch and Flower.
4.  Implement the contract interaction logic (using web3.py) to talk to the deployed smart contracts (register machine, claim rewards).
5.  Dockerize the client application for easy deployment by the Cluster Manager.

**Phase 4: Integration, Demo, & Testing (Day 6)**
1.  Write the testing and demonstration scripts.
2.  Perform an end-to-end test:
    *   Run 3 client instances in *provider mode* to list them.
    *   Use a script to rent them via the contract, forming a cluster.
    *   Run the orchestrator.
    *   Run 2 client instances in *contributor mode* with local data (e.g., MNIST dataset).
    *   Initiate a training job via the API and watch as the global model improves over rounds and $DUCK rewards are distributed.
3.  Build a simple React dashboard that fetches and displays data from the orchestrator's API and the blockchain.
4.  Record a video demo walking through the entire process: listing compute, renting a cluster, training a model, and earning rewards. **This is critical for judges.**

**Final Output Must Include:**
*   A well-structured GitHub repository.
*   A comprehensive `README.md` with setup instructions, environment variables, and demo video link.
*   `docker-compose.yml` for local development and testing.
*   Clean, commented code.
*   A short document explaining how this utilizes AWS credits and the DuckChain SDK.

