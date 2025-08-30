import json
import os
from web3 import Web3
from typing import Any, Dict
from ..config import settings

class Contracts:
    def __init__(self):
        self.w3 = Web3(
            Web3.HTTPProvider(
                settings.web3_provider_url,
                request_kwargs={"timeout": 10}
            )
        )
        self._contracts: Dict[str, Any] = {}
        self._load_contracts()

    def _load_contracts(self):
        abi_dir = settings.contracts_abi_dir
        mapping = {
            "DUCK": settings.duck_token_address,
            "ComputeMarketplace": settings.compute_marketplace_address,
            "TrainingPool": settings.training_pool_address,
            "InferencePool": settings.inference_pool_address,
        }
        for name, address in mapping.items():
            abi_path = os.path.join(abi_dir, f"{name}.json")
            if not os.path.exists(abi_path) or int(address, 16) == 0:
                continue
            with open(abi_path, "r") as f:
                abi = json.load(f)
            self._contracts[name] = self.w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)

    def get(self, name: str):
        if name not in self._contracts:
            loaded = ", ".join(sorted(self._contracts.keys())) or "<none>"
            raise KeyError(f"Contract '{name}' is not loaded. Loaded: {loaded}. Ensure ABI exists in '{settings.contracts_abi_dir}' and address env var is set.")
        return self._contracts[name]

    def list_loaded(self):
        return sorted(self._contracts.keys())

contracts = Contracts()

