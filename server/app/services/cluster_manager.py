from typing import List, Optional, Set, Dict
import json
import time
import requests
import paramiko
from ..config import settings
from .contracts import contracts
from web3 import Web3
from eth_account import Account

class ClusterManager:
    def __init__(self):
        self._allocated: dict[int, List[str]] = {}

    def provision(
        self,
        job_id: int,
        hosts: List[str],
        username: str,
        key_path: str,
        *,
        image: str = "quackmesh-client:latest",
        worker_port: int = 9000,
        env: Optional[Dict[str, str]] = None,
        pull: bool = True,
        health_retries: int = 10,
        health_timeout: float = 2.0,
        connect_timeout: float = 8.0,
        cmd_timeout: float = 30.0,
    ) -> Dict[str, Dict[str, str] | List[str]]:
        """Provision worker containers on remote hosts via SSH.

        Returns a dict with:
        - results: mapping host -> status string (container id, started, or error: ...)
        - nodes: list of endpoints host:port that passed health check
        """
        if not hosts:
            return {"results": {}, "nodes": []}

        results: Dict[str, str] = {}
        env = dict(env or {})

        # Inject API_KEY into environment if configured and not provided
        if settings.api_key and "API_KEY" not in env:
            env["API_KEY"] = settings.api_key

        # Build docker env flags
        env_flags = " ".join(f"-e {k}='{v}'" for k, v in env.items())

        healthy_endpoints: List[str] = []
        for host in hosts:
            name = f"qm-worker-{job_id}-{worker_port}"
            pull_cmd = f"docker pull {image} >/dev/null 2>&1 || true && " if pull else ""
            cmd = (
                f"{pull_cmd}"
                f"docker rm -f {name} >/dev/null 2>&1 || true && "
                f"docker run -d --name {name} -p {worker_port}:{worker_port} {env_flags} {image} "
                f"worker --host 0.0.0.0 --port {worker_port}"
            )
            try:
                out = self.ssh_execute(
                    host,
                    username,
                    key_path,
                    cmd,
                    connect_timeout=connect_timeout,
                    cmd_timeout=cmd_timeout,
                )
                cid = out.strip() or "started"
                results[host] = cid
            except Exception as e:
                results[host] = f"error: {e}"
                continue

            # Health check loop
            health_url = f"http://{host}:{worker_port}/health"
            ok = False
            for _ in range(max(1, int(health_retries))):
                try:
                    r = requests.get(health_url, timeout=health_timeout)
                    if r.status_code == 200:
                        ok = True
                        break
                except Exception:
                    pass
                time.sleep(0.8)

            if ok:
                healthy_endpoints.append(f"{host}:{worker_port}")
            else:
                # mark that container started but health not ready
                results[host] = results.get(host, "started") + " (no health)"

        # Persist in-memory allocation
        self._allocated[job_id] = list(healthy_endpoints)
        return {"results": results, "nodes": healthy_endpoints}

    def get_cluster(self, job_id: int) -> List[str]:
        return self._allocated.get(job_id, [])

    def ssh_execute(
        self,
        host: str,
        username: str,
        key_path: str,
        command: str,
        *,
        connect_timeout: float = 8.0,
        cmd_timeout: float = 30.0,
    ) -> str:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                host,
                username=username,
                key_filename=key_path,
                timeout=connect_timeout,
                banner_timeout=connect_timeout,
                auth_timeout=connect_timeout,
            )
            stdin, stdout, stderr = client.exec_command(command, timeout=cmd_timeout)
            out = stdout.read().decode()
            err = stderr.read().decode()
            exit_code = stdout.channel.recv_exit_status()
        finally:
            try:
                client.close()
            except Exception:
                pass
        if exit_code != 0:
            raise RuntimeError(err or out or f"command failed with exit {exit_code}")
        return out

    def validate_rentals(self, machine_ids: List[int], renter: Optional[str] = None, lookback_blocks: int = 5000) -> Set[int]:
        """Validate that each machine_id has a recent MachineRented event.

        - If contracts are not configured/loaded, returns an empty set (caller decides policy).
        - If renter is provided, require that event.renter == renter.
        - Uses a block lookback window to limit provider queries.
        """
        validated: Set[int] = set()
        try:
            cm = contracts.get("ComputeMarketplace")
        except KeyError:
            return validated  # contracts not configured; caller may allow fallback

        w3 = contracts.w3
        latest = 0
        try:
            latest = w3.eth.block_number
        except Exception:
            latest = 0
        from_block = max(0, latest - max(lookback_blocks, 1)) if latest else 0

        try:
            event = cm.events.MachineRented
            logs = event().get_logs(fromBlock=from_block, toBlock="latest")
        except Exception:
            # Provider may not support get_logs or event filters
            return validated

        # Normalize renter address for comparison
        renter_norm = None
        if renter:
            try:
                renter_norm = w3.to_checksum_address(renter)
            except Exception:
                renter_norm = renter

        target_ids = set(int(mid) for mid in machine_ids)
        for log in logs:
            try:
                ev = event().process_log(log)
                mid = int(ev["args"]["machineId"]) if "machineId" in ev["args"] else None
                rent_addr = ev["args"].get("renter") if "args" in ev else None
                if mid is None:
                    continue
                if renter_norm and rent_addr:
                    try:
                        rent_addr = w3.to_checksum_address(rent_addr)
                    except Exception:
                        pass
                    if rent_addr != renter_norm:
                        continue
                if mid in target_ids:
                    validated.add(mid)
            except Exception:
                continue

        return validated

    def rent_machines(self, machine_ids: List[int], hours: int, renter_private_key: str) -> Dict:
        """Rent machines on-chain using the renter's private key.

        Returns a dict with renter_address, total_required, approvals, and per-machine tx hashes.
        Requires settings.compute_marketplace_address and DUCK token deployed per ComputeMarketplace contract.
        """
        # Validate inputs
        if not renter_private_key:
            raise ValueError("renter_private_key required")
        if not machine_ids:
            raise ValueError("machine_ids required")
        try:
            hours = int(hours)
        except Exception:
            raise ValueError("hours must be integer")
        if hours <= 0 or hours > 720:
            raise ValueError("hours must be between 1 and 720")

        w3 = contracts.w3
        try:
            acct = Account.from_key(renter_private_key)
        except Exception:
            raise ValueError("invalid renter_private_key")

        # Minimal ABIs (fallback when full ABIs not loaded)
        cm_abi = [
            {
                "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "name": "machines",
                "outputs": [
                    {"internalType": "address", "name": "provider", "type": "address"},
                    {"internalType": "string", "name": "specs", "type": "string"},
                    {"internalType": "uint256", "name": "pricePerHourInDuck", "type": "uint256"},
                    {"internalType": "bool", "name": "listed", "type": "bool"},
                ],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "inputs": [],
                "name": "duckToken",
                "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "machineId", "type": "uint256"},
                    {"internalType": "uint256", "name": "hoursPaid", "type": "uint256"},
                ],
                "name": "rentMachine",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function",
            },
        ]

        erc20_abi = [
            {
                "constant": False,
                "inputs": [
                    {"name": "spender", "type": "address"},
                    {"name": "value", "type": "uint256"},
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function",
            },
            {
                "constant": True,
                "inputs": [
                    {"name": "owner", "type": "address"},
                    {"name": "spender", "type": "address"},
                ],
                "name": "allowance",
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

        # Prefer loaded contract instances; fallback to minimal
        try:
            cm = contracts.get("ComputeMarketplace")
        except KeyError:
            cm_addr = settings.compute_marketplace_address
            if not cm_addr or int(cm_addr, 16) == 0:
                raise RuntimeError("ComputeMarketplace contract not configured (address/ABI)")
            cm = w3.eth.contract(address=Web3.to_checksum_address(cm_addr), abi=cm_abi)

        try:
            duck_addr = cm.functions.duckToken().call()
        except Exception as e:
            raise RuntimeError(f"failed to read duckToken address: {e}")
        try:
            duck = contracts.get("DUCK")
        except KeyError:
            duck = w3.eth.contract(address=Web3.to_checksum_address(duck_addr), abi=erc20_abi)

        # Calculate total required DUCK in wei
        total_required = 0
        mids = [int(m) for m in machine_ids]
        for mid in mids:
            try:
                m = cm.functions.machines(mid).call()
            except Exception as e:
                raise RuntimeError(f"failed to fetch machine {mid}: {e}")
            price = int(m[2])
            listed = bool(m[3])
            if not listed:
                raise RuntimeError(f"machineId {mid} is not listed")
            total_required += price * int(hours)

        # Approve if needed
        try:
            allowance = int(duck.functions.allowance(acct.address, cm.address).call())
        except Exception as e:
            raise RuntimeError(f"failed to read allowance: {e}")
        try:
            nonce = w3.eth.get_transaction_count(acct.address)
        except Exception as e:
            raise RuntimeError(f"failed to get nonce: {e}")
        try:
            gas_price = w3.eth.gas_price
        except Exception:
            gas_price = w3.to_wei("2", "gwei")
        receipts: dict = {"approve_tx": None, "rent_txs": []}
        if allowance < total_required:
            tx = duck.functions.approve(cm.address, int(total_required)).build_transaction(
                {
                    "from": acct.address,
                    "nonce": nonce,
                    "chainId": int(settings.duckchain_chain_id),
                    "gas": 150_000,
                    "gasPrice": int(gas_price),
                }
            )
            signed = Account.sign_transaction(tx, renter_private_key)
            tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
            rcpt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
            if rcpt.status != 1:
                raise RuntimeError("ERC20 approve failed")
            receipts["approve_tx"] = tx_hash.hex()
            nonce += 1

        # Rent each machine
        for mid in mids:
            tx = cm.functions.rentMachine(int(mid), int(hours)).build_transaction(
                {
                    "from": acct.address,
                    "nonce": nonce,
                    "chainId": int(settings.duckchain_chain_id),
                    "gas": 400_000,
                    "gasPrice": int(gas_price),
                }
            )
            signed = Account.sign_transaction(tx, renter_private_key)
            tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
            rcpt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
            if rcpt.status != 1:
                raise RuntimeError(f"rentMachine failed for machineId {mid}")
            receipts["rent_txs"].append(tx_hash.hex())
            nonce += 1

        return {
            "renter_address": acct.address,
            "total_required": int(total_required),
            "approve_tx": receipts.get("approve_tx"),
            "rent_txs": receipts.get("rent_txs", []),
        }

cluster_manager = ClusterManager()
