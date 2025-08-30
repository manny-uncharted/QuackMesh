# QuackMesh Tasks

A living checklist of remaining work. Mark items as completed when done.

## Backend Orchestrator
- [x] Health/readiness endpoints and middleware (CORS, GZip, request ID)
- [x] Alembic baseline and configuration
- [x] Real initial migration script and database stamped to head for fresh DBs
- [x] API key auth and rate limiting
- [x] Implement on-chain event listener to react to TrainingPool and marketplace events (`server/app/services/events.py`)
- [x] Extend cluster manager to rent N machines via `ComputeMarketplace.sol` and validate rental state (`server/app/services/cluster_manager.py`)
- [x] Cluster provisioning: SSH/Docker deploy of client worker on rented nodes
- [x] Structured JSON logging and Prometheus metrics (`/metrics`) for requests, rate limits, jobs

## Client (Contributors/Providers)
- [x] Contributor mode: fetch/submit updates full integration
- [x] Provider mode: `listMachine` + orchestrator registration
- [x] Provider training worker: long-running process to receive tasks and run training steps
- [ ] Federated learning integration (Flower/PyTorch) to replace simulated updates
- [ ] Datasets: simple pipeline for MNIST or similar for demo

## Smart Contracts & Integration
- [x] Contracts: `ComputeMarketplace.sol`, `TrainingPool.sol`, `InferencePool.sol`
- [x] Deploy and tests scaffold under `contracts/`
- [ ] Wire orchestrator to contracts for renting, job lifecycle, and rewards
- [x] Document required env vars and ABI/address wiring in README

## Frontend Dashboard (Next.js + Ethers.js)
- [ ] implement frontend `frontend/` with Next.js and client-side pages
- [ ] Marketplace view: provider listings and rent action
- [ ] Jobs view: global model accuracy over rounds (chart)
- [ ] Contracts activity: recent transactions/events
- [ ] Orchestrator integration: consume REST endpoints

## Migrations & Data
- [x] Create and register initial Alembic migration that creates tables
- [ ] Add future schema change migrations as needed

## Deployment (AWS)
- [ ] EC2 setup script or docs for orchestrator
- [ ] RDS (Postgres) and ElastiCache (Redis) configuration docs
- [ ] CI/CD pipeline to build and push images; run Alembic migrations on deploy

## Demo & Docs
- [x] Local docker-compose for dev/test
- [x] End-to-end demo script (providers, rent cluster, run contributors)
- [ ] README updates: detailed steps and troubleshooting
- [ ] Optional: record demo video link
