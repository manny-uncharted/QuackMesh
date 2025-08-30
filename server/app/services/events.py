import threading
import time
import logging
from .contracts import contracts
from ..db import get_session
from ..models import Job, ModelArtifact, ProviderMachine, ClusterNode
from ..config import settings
from sqlalchemy import select
import requests

class EventListener:
    def __init__(self):
        self._stop = False
        self._thread: threading.Thread | None = None
        self._tp_filter = None  # TrainingPool event filter
        self._logger = logging.getLogger("quackmesh.events")

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop = False
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop = True
        # thread is daemon; no join needed on shutdown

    def _ensure_filters(self):
        # Create TrainingPool filter if contract is loaded
        if self._tp_filter is None:
            try:
                tp = contracts.get("TrainingPool")
            except KeyError:
                return
            try:
                self._tp_filter = tp.events.TrainingJobCreated.create_filter(fromBlock="latest")
                self._logger.info("Created TrainingPool.TrainingJobCreated filter")
            except Exception as e:
                # Provider may not support filters or contract not deployed yet
                self._logger.debug("Failed to create TrainingJobCreated filter: %s", e)

    def _run(self):
        while not self._stop:
            try:
                self._ensure_filters()
                # Poll events if filter exists
                if self._tp_filter is not None:
                    for ev in self._tp_filter.get_new_entries():
                        try:
                            args = ev["args"] if isinstance(ev, dict) and "args" in ev else getattr(ev, "args", {})
                            self._logger.info("TrainingJobCreated event: args=%s", args)
                            # Extract fields
                            chain_job_id = int(args.get("jobId")) if args and "jobId" in args else None
                            total_reward_wei = int(args.get("totalReward")) if args and "totalReward" in args else 0

                            # Resolve DUCK decimals if possible
                            duck_decimals = 18
                            try:
                                duck = contracts.get("DUCK")
                                duck_decimals = duck.functions.decimals().call()
                            except Exception:
                                pass
                            reward_duck = float(total_reward_wei) / float(10 ** duck_decimals) if total_reward_wei else 0.0

                            # Create Job and ModelArtifact if missing
                            if chain_job_id is not None:
                                endpoints_assigned: list[str] = []
                                with get_session() as session:
                                    existing = session.get(Job, chain_job_id)
                                    if not existing:
                                        job = Job(id=chain_job_id, model_arch="from_chain", reward_pool_duck=reward_duck)
                                        session.add(job)
                                        session.flush()
                                        artifact = ModelArtifact(job_id=job.id, weights=[])
                                        session.add(artifact)
                                        self._logger.info("Created orchestrator Job id=%s from chain event", chain_job_id)
                                    else:
                                        # Update reward if currently zero
                                        if not existing.reward_pool_duck and reward_duck:
                                            existing.reward_pool_duck = reward_duck

                                    # Auto-assign cluster if enabled and not already assigned
                                    assigned = session.execute(select(ClusterNode).where(ClusterNode.job_id == chain_job_id)).scalars().all()
                                    if settings.auto_assign_on_event and not assigned:
                                        size = max(1, int(settings.auto_assign_size))
                                        provs = (
                                            session.execute(
                                                select(ProviderMachine).where(ProviderMachine.endpoint.is_not(None)).limit(size)
                                            ).scalars().all()
                                        )
                                        for pm in provs:
                                            session.add(ClusterNode(job_id=chain_job_id, machine_id=pm.machine_id, endpoint=pm.endpoint))
                                        endpoints_assigned = [pm.endpoint for pm in provs]
                                        if endpoints_assigned:
                                            self._logger.info(
                                                "Auto-assigned %d nodes for job %s: %s",
                                                len(endpoints_assigned),
                                                chain_job_id,
                                                endpoints_assigned,
                                            )
                                        else:
                                            self._logger.warning("Auto-assign enabled but no provider endpoints available")
                                    else:
                                        endpoints_assigned = [n.endpoint for n in assigned]

                                # Optionally kick off a training round directly to providers
                                if settings.auto_start_round_on_event and endpoints_assigned:
                                    steps = max(1, int(settings.auto_round_steps))
                                    for ep in endpoints_assigned:
                                        url = f"http://{ep}/task/train"
                                        try:
                                            rr = requests.post(url, json={"job_id": chain_job_id, "steps": steps}, timeout=20)
                                            self._logger.info("Start round -> %s status=%s body=%s", url, rr.status_code, rr.text[:200])
                                        except Exception as e:
                                            self._logger.warning("Failed starting round on %s: %s", ep, e)
                        except Exception as e:
                            self._logger.exception("Error handling TrainingJobCreated event: %s", e)
                time.sleep(5)
            except Exception as e:
                # Do not crash the listener loop
                self._logger.debug("Event loop error: %s", e)
                time.sleep(5)

listener = EventListener()
