import argparse
import os
import time
import json
import psutil
import requests
import numpy as np
from typing import List
from web3 import Web3
from eth_account import Account
from pathlib import Path
import uvicorn
from .worker_server import create_app

API_BASE = os.getenv("ORCHESTRATOR_API", "http://localhost:8000/api")
API_KEY = os.getenv("API_KEY")

def api_headers():
    return {"X-API-Key": API_KEY} if API_KEY else None


def get_specs_json() -> str:
    cpu = psutil.cpu_count(logical=True)
    ram_gb = round(psutil.virtual_memory().total / (1024**3), 2)
    # GPU detection could be added via nvidia-smi parsing
    specs = {"cpu": cpu, "gpu": 0, "ram_gb": ram_gb}
    return json.dumps(specs)


def random_init(shape_list: List[int]) -> List[List[float]]:
    rs = np.random.RandomState(42)
    weights: List[List[float]] = []
    for n in shape_list:
        weights.append((rs.randn(n) * 0.01).astype(np.float32).tolist())
    return weights


def contributor(job_id: int, steps: int = 1):
    # fetch model
    r = requests.get(f"{API_BASE}/job/{job_id}/model", timeout=10)
    r.raise_for_status()
    data = r.json()
    weights = data.get("weights") or random_init([128, 10])

    # train locally (dummy training on random data to keep lightweight)
    for _ in range(steps):
        # simulate small update: add small noise
        weights = [(np.array(w) + np.random.randn(*np.array(w).shape) * 0.001).astype(np.float32).tolist() for w in weights]

    # simple validation accuracy proxy
    val_acc = float(np.clip(70 + np.random.randn() * 5, 0, 100))

    r = requests.post(
        f"{API_BASE}/job/{job_id}/update",
        json={"weights": weights, "val_accuracy": val_acc},
        headers=api_headers(),
        timeout=10,
    )
    r.raise_for_status()
    print("Submitted update, val_acc=", val_acc)


def provider_list_machine():
    # Env configuration
    rpc = os.getenv("WEB3_PROVIDER_URL", "http://localhost:8545")
    cm_addr = os.getenv("COMPUTE_MARKETPLACE_ADDRESS")
    chain_id = int(os.getenv("DUCKCHAIN_CHAIN_ID", "1337"))
    priv_key = os.getenv("PROVIDER_PRIVATE_KEY")
    endpoint = os.getenv("PROVIDER_ENDPOINT")  # e.g. host:port for incoming tasks
    price_per_hour = int(os.getenv("PRICE_PER_HOUR_DUCK", "1000000000000000000"))  # default 1 DUCK

    if not cm_addr or not priv_key:
        raise SystemExit("COMPUTE_MARKETPLACE_ADDRESS and PROVIDER_PRIVATE_KEY env vars are required")

    # Specs
    specs = os.getenv("PROVIDER_SPECS_JSON") or get_specs_json()

    # Load ABI
    abi_path = Path(__file__).parent / "abi" / "ComputeMarketplace.json"
    with open(abi_path, "r") as f:
        cm_abi = json.load(f)

    w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 10}))
    acct = Account.from_key(priv_key)
    contract = w3.eth.contract(address=Web3.to_checksum_address(cm_addr), abi=cm_abi)

    # Build and send tx
    nonce = w3.eth.get_transaction_count(acct.address)
    tx = contract.functions.listMachine(specs, price_per_hour).build_transaction(
        {
            "from": acct.address,
            "nonce": nonce,
            "chainId": chain_id,
            "gas": 500_000,
            "gasPrice": w3.to_wei("2", "gwei"),
        }
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    # Parse event for machineId
    machine_id = None
    for log in receipt.logs:
        try:
            ev = contract.events.MachineListed().process_log(log)
            machine_id = ev["args"]["machineId"]
            break
        except Exception:
            continue
    if machine_id is None:
        raise RuntimeError("Failed to parse MachineListed event; cannot determine machineId")

    # Register with orchestrator
    provider_address = acct.address
    payload = {
        "machine_id": int(machine_id),
        "provider_address": provider_address,
        "specs": specs,
        "endpoint": endpoint,
    }
    r = requests.post(
        f"{API_BASE}/provider/register",
        json=payload,
        headers=api_headers(),
        timeout=10,
    )
    r.raise_for_status()
    print(f"Registered provider machine_id={machine_id} endpoint={endpoint} with orchestrator")


def renter_rent_and_assign(job_id: int, machine_ids: List[int], hours: int, assign: bool = True):
    # Env configuration
    rpc = os.getenv("WEB3_PROVIDER_URL", "http://localhost:8545")
    cm_addr = os.getenv("COMPUTE_MARKETPLACE_ADDRESS")
    duck_addr = os.getenv("DUCK_TOKEN_ADDRESS")
    chain_id = int(os.getenv("DUCKCHAIN_CHAIN_ID", "1337"))
    priv_key = os.getenv("RENTER_PRIVATE_KEY")

    if not cm_addr or not duck_addr or not priv_key:
        raise SystemExit("COMPUTE_MARKETPLACE_ADDRESS, DUCK_TOKEN_ADDRESS and RENTER_PRIVATE_KEY env vars are required")

    # Load ABIs
    abi_path = Path(__file__).parent / "abi" / "ComputeMarketplace.json"
    with open(abi_path, "r") as f:
        cm_abi = json.load(f)

    # Minimal ERC20 ABI for approve/allowance/balance
    erc20_abi = [
        {
            "constant": False,
            "inputs": [
                {"name": "spender", "type": "address"},
                {"name": "value", "type": "uint256"}
            ],
            "name": "approve",
            "outputs": [{"name": "", "type": "bool"}],
            "type": "function",
        },
        {
            "constant": True,
            "inputs": [
                {"name": "owner", "type": "address"},
                {"name": "spender", "type": "address"}
            ],
            "name": "allowance",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function",
        },
        {
            "constant": True,
            "inputs": [{"name": "", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function",
        },
        {
            "constant": True,
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "type": "function",
        },
    ]

    w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 10}))
    acct = Account.from_key(priv_key)
    cm = w3.eth.contract(address=Web3.to_checksum_address(cm_addr), abi=cm_abi)
    duck = w3.eth.contract(address=Web3.to_checksum_address(duck_addr), abi=erc20_abi)

    # Determine required total DUCK by summing pricePerHour * hours for each machine
    total_required = 0
    machine_ids_int = [int(m) for m in machine_ids]
    for mid in machine_ids_int:
        m = cm.functions.machines(mid).call()
        # struct Machine { provider, specs, pricePerHourInDuck, listed }
        price_per_hour = int(m[2])
        listed = bool(m[3])
        if not listed:
            raise SystemExit(f"machineId {mid} is not listed")
        total_required += price_per_hour * int(hours)

    # Check allowance and approve if needed
    allowance = duck.functions.allowance(acct.address, cm.address).call()
    nonce = w3.eth.get_transaction_count(acct.address)
    if allowance < total_required:
        tx = duck.functions.approve(cm.address, total_required).build_transaction(
            {
                "from": acct.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gas": 150_000,
                "gasPrice": w3.to_wei("2", "gwei"),
            }
        )
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt.status != 1:
            raise SystemExit("ERC20 approve failed")
        nonce += 1

    # Rent each machine
    for mid in machine_ids_int:
        tx = cm.functions.rentMachine(mid, int(hours)).build_transaction(
            {
                "from": acct.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gas": 400_000,
                "gasPrice": w3.to_wei("2", "gwei"),
            }
        )
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
        if receipt.status != 1:
            raise SystemExit(f"rentMachine failed for machineId {mid}")
        nonce += 1

    print(f"Rented machines {machine_ids_int} for {hours}h as {acct.address}")

    # Optionally assign in orchestrator with renter_address for validation
    if assign:
        payload = {"job_id": int(job_id), "machine_ids": machine_ids_int, "renter_address": acct.address}
        r = requests.post(
            f"{API_BASE}/cluster/assign",
            json=payload,
            headers=api_headers(),
            timeout=15,
        )
        r.raise_for_status()
        print(f"Assigned cluster for job_id={job_id}: {r.json()}")


def requester_create_job(model_hash_hex: str, total_duck: float):
    # Env configuration
    rpc = os.getenv("WEB3_PROVIDER_URL", "http://localhost:8545")
    tp_addr = os.getenv("TRAINING_POOL_ADDRESS")
    duck_addr = os.getenv("DUCK_TOKEN_ADDRESS")
    chain_id = int(os.getenv("DUCKCHAIN_CHAIN_ID", "1337"))
    priv_key = os.getenv("REQUESTER_PRIVATE_KEY")

    if not tp_addr or not duck_addr or not priv_key:
        raise SystemExit("TRAINING_POOL_ADDRESS, DUCK_TOKEN_ADDRESS and REQUESTER_PRIVATE_KEY env vars are required")

    # Minimal ABIs
    training_pool_abi = [
        {
            "inputs": [
                {"internalType": "bytes32", "name": "modelHash", "type": "bytes32"},
                {"internalType": "uint256", "name": "totalRewardPool", "type": "uint256"},
            ],
            "name": "createTrainingJob",
            "outputs": [{"internalType": "uint256", "name": "jobId", "type": "uint256"}],
            "stateMutability": "nonpayable",
            "type": "function",
        },
        {
            "anonymous": False,
            "inputs": [
                {"indexed": True, "internalType": "uint256", "name": "jobId", "type": "uint256"},
                {"indexed": True, "internalType": "address", "name": "requester", "type": "address"},
                {"indexed": False, "internalType": "bytes32", "name": "modelHash", "type": "bytes32"},
                {"indexed": False, "internalType": "uint256", "name": "totalReward", "type": "uint256"},
            ],
            "name": "TrainingJobCreated",
            "type": "event",
        },
    ]
    erc20_abi = [
        {"constant": False, "inputs": [{"name": "spender", "type": "address"}, {"name": "value", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "type": "function"},
        {"constant": True, "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "type": "function"},
        {"constant": True, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function"},
        {"constant": True, "inputs": [{"name": "", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "type": "function"},
    ]

    w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 10}))
    acct = Account.from_key(priv_key)
    tp = w3.eth.contract(address=Web3.to_checksum_address(tp_addr), abi=training_pool_abi)
    duck = w3.eth.contract(address=Web3.to_checksum_address(duck_addr), abi=erc20_abi)

    # Amount in wei based on decimals
    decimals = duck.functions.decimals().call()
    amount_wei = int(total_duck * (10 ** decimals))

    # Approve if needed
    allowance = duck.functions.allowance(acct.address, tp.address).call()
    nonce = w3.eth.get_transaction_count(acct.address)
    if allowance < amount_wei:
        tx = duck.functions.approve(tp.address, amount_wei).build_transaction(
            {"from": acct.address, "nonce": nonce, "chainId": chain_id, "gas": 120_000, "gasPrice": w3.to_wei("2", "gwei")}
        )
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt.status != 1:
            raise SystemExit("ERC20 approve failed")
        nonce += 1

    # Create job
    # model_hash must be 32-byte hex string (0x...)
    if not model_hash_hex.startswith("0x") or len(model_hash_hex) != 66:
        raise SystemExit("model_hash must be 0x-prefixed 32-byte hex string (length 66)")
    tx = tp.functions.createTrainingJob(model_hash_hex, amount_wei).build_transaction(
        {"from": acct.address, "nonce": nonce, "chainId": chain_id, "gas": 500_000, "gasPrice": w3.to_wei("2", "gwei")}
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    if receipt.status != 1:
        raise SystemExit("createTrainingJob tx failed")

    job_id = None
    for log in receipt.logs:
        try:
            ev = tp.events.TrainingJobCreated().process_log(log)
            job_id = int(ev["args"]["jobId"])
            break
        except Exception:
            continue
    if job_id is None:
        raise SystemExit("Could not parse TrainingJobCreated event")

    print(f"Created Training job on-chain job_id={job_id} requester={acct.address} total_duck={total_duck}")
    print("The orchestrator event listener should auto-create Job with the same id.")

def main():
    parser = argparse.ArgumentParser(description="QuackMesh Client")
    sub = parser.add_subparsers(dest="mode")

    pc = sub.add_parser("contributor")
    pc.add_argument("--job-id", type=int, required=True)
    pc.add_argument("--steps", type=int, default=1)

    pp = sub.add_parser("provider")
    # provider uses env vars; optional overrides
    pp.add_argument("--price-wei", type=int, help="Override price per hour in wei (DUCK)")
    pp.add_argument("--endpoint", type=str, help="Override provider endpoint host:port")

    pr = sub.add_parser("renter")
    pr.add_argument("--job-id", type=int, required=True)
    pr.add_argument("--machine-ids", type=str, required=True, help="Comma-separated machine ids, e.g. 1,2,3")
    pr.add_argument("--hours", type=int, default=1)
    pr.add_argument("--no-assign", action="store_true", help="Only rent; do not call orchestrator assign")

    rq = sub.add_parser("requester")
    rq.add_argument("--model-hash", type=str, required=True, help="0x-prefixed 32-byte hex of initial model")
    rq.add_argument("--reward-duck", type=float, required=True, help="Total reward pool in DUCK tokens (float)")

    wk = sub.add_parser("worker")
    wk.add_argument("--host", type=str, default="0.0.0.0")
    wk.add_argument("--port", type=int, default=9000)

    args = parser.parse_args()
    if args.mode == "contributor":
        contributor(args.job_id, steps=args.steps)
    elif args.mode == "provider":
        if getattr(args, "price_wei", None) is not None:
            os.environ["PRICE_PER_HOUR_DUCK"] = str(args.price_wei)
        if getattr(args, "endpoint", None):
            os.environ["PROVIDER_ENDPOINT"] = args.endpoint
        provider_list_machine()
    elif args.mode == "renter":
        mids = [int(x) for x in str(args.machine_ids).split(",") if x.strip()]
        renter_rent_and_assign(args.job_id, mids, hours=int(args.hours), assign=not args.no_assign)
    elif args.mode == "requester":
        requester_create_job(args.model_hash, float(args.reward_duck))
    elif args.mode == "worker":
        uvicorn.run(create_app(), host=args.host, port=int(args.port))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
