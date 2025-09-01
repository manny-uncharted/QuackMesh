#!/usr/bin/env python3
import os
import json
import argparse
from pathlib import Path
import requests
from web3 import Web3
from eth_account import Account

API_KEY = os.getenv("API_KEY")

def api_headers():
    return {"X-API-Key": API_KEY} if API_KEY else None


def load_abi() -> list:
    # Use client ABI to avoid duplication
    abi_path = Path(__file__).resolve().parents[1] / "client" / "quackmesh_client" / "abi" / "ComputeMarketplace.json"
    with open(abi_path, "r") as f:
        return json.load(f)


def register_entry(w3: Web3, cm_addr: str, chain_id: int, entry: dict, api_base: str):
    priv_key = entry["private_key"]
    endpoint = entry.get("endpoint")
    price_wei = int(entry.get("price_wei", os.getenv("PRICE_PER_HOUR_DUCK", "1000000000000000000")))
    specs = entry.get("specs") or os.getenv("PROVIDER_SPECS_JSON")
    if specs is None:
        specs = json.dumps({"cpu": 4, "gpu": 0, "ram_gb": 8})

    acct = Account.from_key(priv_key)
    contract = w3.eth.contract(address=Web3.to_checksum_address(cm_addr), abi=load_abi())

    # Send tx
    nonce = w3.eth.get_transaction_count(acct.address)
    tx = contract.functions.listMachine(specs, price_wei).build_transaction(
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

    machine_id = None
    for log in receipt.logs:
        try:
            ev = contract.events.MachineListed().process_log(log)
            machine_id = int(ev["args"]["machineId"])
            break
        except Exception:
            continue
    if machine_id is None:
        raise RuntimeError("Failed to get machineId from event")

    payload = {
        "machine_id": machine_id,
        "provider_address": acct.address,
        "specs": specs,
        "endpoint": endpoint,
    }
    r = requests.post(
        f"{api_base}/provider/register",
        json=payload,
        headers=api_headers(),
        timeout=10,
    )
    r.raise_for_status()
    return machine_id


def main():
    parser = argparse.ArgumentParser(description="Bulk register provider machines")
    parser.add_argument("--input", required=True, help="Path to JSON file of provider entries")
    parser.add_argument("--api", default=os.getenv("ORCHESTRATOR_API", "https://8000-01k42mwc8wv62x7je6az5zqksp.cloudspaces.litng.ai/api"))
    parser.add_argument("--rpc", default=os.getenv("WEB3_PROVIDER_URL", "http://localhost:8545"))
    parser.add_argument("--market", default=os.getenv("COMPUTE_MARKETPLACE_ADDRESS"))
    parser.add_argument("--chain-id", type=int, default=int(os.getenv("DUCKCHAIN_CHAIN_ID", "1337")))
    args = parser.parse_args()

    if not args.market:
        raise SystemExit("COMPUTE_MARKETPLACE_ADDRESS must be set or provided via --market")

    with open(args.input, "r") as f:
        entries = json.load(f)
    if not isinstance(entries, list):
        raise SystemExit("Input JSON must be a list of entries")

    w3 = Web3(Web3.HTTPProvider(args.rpc))
    results = []
    for idx, entry in enumerate(entries):
        mid = register_entry(w3, args.market, args.chain_id, entry, args.api)
        results.append({"index": idx, "machine_id": mid})
        print(f"Registered entry #{idx}: machine_id={mid}")

    out_path = Path(args.input).with_suffix(".out.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Wrote results to {out_path}")


if __name__ == "__main__":
    main()

