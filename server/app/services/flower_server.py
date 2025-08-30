import os
import threading
import logging
from typing import List, Optional, Dict, Any

import numpy as np
import flwr as fl

from ..db import get_session
from ..models import ModelArtifact

logger = logging.getLogger("quackmesh.flower")

# In-memory registry of running Flower servers by job_id
_running_servers: Dict[int, threading.Thread] = {}


def _to_parameters(weights: List[List[float]]) -> fl.common.Parameters:
    nds = [np.array(w, dtype=np.float32) for w in weights]
    return fl.common.ndarrays_to_parameters(nds)


def _from_parameters(params: fl.common.Parameters) -> List[List[float]]:
    nds = fl.common.parameters_to_ndarrays(params)
    return [nd.astype(np.float32).ravel().tolist() for nd in nds]


class _Strategy(fl.server.strategy.FedAvg):
    def __init__(self, job_id: int, initial_params: Optional[fl.common.Parameters]):
        super().__init__()
        self.job_id = job_id
        self.initial_params = initial_params

    def initialize_parameters(self, client_manager: fl.server.client_manager.ClientManager) -> Optional[fl.common.Parameters]:
        return self.initial_params

    def aggregate_fit(
        self,
        server_round: int,
        results: List[fl.server.client_proxy.FitRes],
        failures: List[BaseException],
    ) -> tuple[Optional[fl.common.Parameters], Dict[str, fl.common.Scalar]]:
        params_agg, metrics_agg = super().aggregate_fit(server_round, results, failures)
        # Persist aggregated weights to DB
        if params_agg is not None:
            try:
                weights = _from_parameters(params_agg)
                with get_session() as session:
                    art = session.query(ModelArtifact).filter(ModelArtifact.job_id == self.job_id).one_or_none()
                    if art:
                        art.weights = weights
                    else:
                        art = ModelArtifact(job_id=self.job_id, weights=weights)
                        session.add(art)
            except Exception as e:
                logger.exception("flower.aggregate.persist.fail", extra={"job_id": self.job_id, "error": str(e)})
        return params_agg, metrics_agg


def start_flower_server(job_id: int, host: str = "0.0.0.0", port: int = 8089, rounds: int = 1) -> Dict[str, Any]:
    if job_id in _running_servers and _running_servers[job_id].is_alive():
        return {"status": "already_running", "host": host, "port": port}

    # Load initial params from DB if exist
    initial_params = None
    try:
        with get_session() as session:
            art = session.query(ModelArtifact).filter(ModelArtifact.job_id == job_id).one_or_none()
            weights = (art.weights or []) if art else []
            if weights:
                initial_params = _to_parameters(weights)
    except Exception:
        initial_params = None

    strategy = _Strategy(job_id=job_id, initial_params=initial_params)

    def _run():
        address = f"{host}:{port}"
        logger.info("flower.server.start", extra={"job_id": job_id, "address": address, "rounds": rounds})
        fl.server.start_server(server_address=address, config=fl.server.ServerConfig(num_rounds=rounds), strategy=strategy)
        logger.info("flower.server.stop", extra={"job_id": job_id})

    th = threading.Thread(target=_run, daemon=True, name=f"flower-server-{job_id}")
    _running_servers[job_id] = th
    th.start()
    return {"status": "started", "host": host, "port": port}


def is_flower_running(job_id: int) -> bool:
    th = _running_servers.get(job_id)
    return bool(th and th.is_alive())
