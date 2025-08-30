#!/usr/bin/env python3
import os
import requests

API = os.getenv("ORCHESTRATOR_API", "http://localhost:8000/api")
API_KEY = os.getenv("API_KEY")
headers = {"X-API-Key": API_KEY} if API_KEY else None

payload = {
  "model_arch": "linear-128-10",
  "initial_weights": [[0.0]*128, [0.0]*10],
  "reward_pool_duck": 0
}

r = requests.post(f"{API}/job", json=payload, headers=headers, timeout=10)
print(r.status_code, r.text)
