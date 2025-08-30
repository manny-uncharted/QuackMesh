"""
Node discovery and P2P networking for QuackMesh
"""
import asyncio
import json
import socket
import time
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
import requests
import logging

logger = logging.getLogger(__name__)

@dataclass
class NodeInfo:
    node_id: str
    address: str
    port: int
    specs: Dict
    last_seen: float
    capabilities: List[str]

class NodeDiscovery:
    """Handles node discovery and peer-to-peer networking"""
    
    def __init__(self, orchestrator_api: str, node_port: int = 9000):
        self.orchestrator_api = orchestrator_api
        self.node_port = node_port
        self.known_nodes: Dict[str, NodeInfo] = {}
        self.local_node_id = self._generate_node_id()
        self.discovery_interval = 30  # seconds
        self.running = False
        
    def _generate_node_id(self) -> str:
        """Generate unique node ID based on machine characteristics"""
        import hashlib
        import platform
        
        machine_info = f"{platform.node()}-{platform.machine()}-{socket.gethostname()}"
        return hashlib.sha256(machine_info.encode()).hexdigest()[:16]
    
    async def start_discovery(self):
        """Start the node discovery process"""
        self.running = True
        logger.info(f"Starting node discovery for {self.local_node_id}")
        
        # Start discovery tasks
        tasks = [
            asyncio.create_task(self._orchestrator_discovery()),
            asyncio.create_task(self._peer_discovery()),
            asyncio.create_task(self._heartbeat_loop()),
        ]
        
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Discovery error: {e}")
        finally:
            self.running = False
    
    async def _orchestrator_discovery(self):
        """Discover nodes through the orchestrator"""
        while self.running:
            try:
                # Fetch provider list from orchestrator
                response = requests.get(f"{self.orchestrator_api}/provider/", timeout=10)
                if response.status_code == 200:
                    providers = response.json().get('providers', [])
                    
                    for provider in providers:
                        if provider.get('endpoint'):
                            node_info = NodeInfo(
                                node_id=str(provider['machine_id']),
                                address=provider['endpoint'].split(':')[0],
                                port=int(provider['endpoint'].split(':')[1]),
                                specs=json.loads(provider.get('specs', '{}')),
                                last_seen=time.time(),
                                capabilities=['training', 'inference']
                            )
                            self.known_nodes[node_info.node_id] = node_info
                            
            except Exception as e:
                logger.warning(f"Orchestrator discovery failed: {e}")
            
            await asyncio.sleep(self.discovery_interval)
    
    async def _peer_discovery(self):
        """Discover nodes through peer-to-peer gossip"""
        while self.running:
            try:
                # Ask known nodes for their peer lists
                for node in list(self.known_nodes.values()):
                    try:
                        # Simple HTTP request to get peer list
                        url = f"http://{node.address}:{node.port}/peers"
                        response = requests.get(url, timeout=5)
                        
                        if response.status_code == 200:
                            peers = response.json().get('peers', [])
                            for peer in peers:
                                if peer['node_id'] not in self.known_nodes:
                                    peer_info = NodeInfo(**peer)
                                    self.known_nodes[peer_info.node_id] = peer_info
                                    
                    except Exception as e:
                        logger.debug(f"Peer discovery from {node.node_id} failed: {e}")
                        
            except Exception as e:
                logger.warning(f"Peer discovery failed: {e}")
            
            await asyncio.sleep(self.discovery_interval * 2)
    
    async def _heartbeat_loop(self):
        """Send heartbeats and clean up stale nodes"""
        while self.running:
            current_time = time.time()
            
            # Remove stale nodes (not seen in 5 minutes)
            stale_nodes = [
                node_id for node_id, node in self.known_nodes.items()
                if current_time - node.last_seen > 300
            ]
            
            for node_id in stale_nodes:
                del self.known_nodes[node_id]
                logger.info(f"Removed stale node: {node_id}")
            
            # Send heartbeat to orchestrator
            try:
                heartbeat_data = {
                    "node_id": self.local_node_id,
                    "timestamp": current_time,
                    "known_peers": len(self.known_nodes),
                    "status": "active"
                }
                
                requests.post(
                    f"{self.orchestrator_api}/node/heartbeat",
                    json=heartbeat_data,
                    timeout=5
                )
                
            except Exception as e:
                logger.debug(f"Heartbeat failed: {e}")
            
            await asyncio.sleep(30)
    
    def get_best_nodes(self, requirements: Dict) -> List[NodeInfo]:
        """Find the best nodes matching requirements"""
        suitable_nodes = []
        
        for node in self.known_nodes.values():
            if self._matches_requirements(node, requirements):
                suitable_nodes.append(node)
        
        # Sort by specs/performance (simple scoring)
        suitable_nodes.sort(key=lambda n: self._score_node(n), reverse=True)
        
        return suitable_nodes
    
    def _matches_requirements(self, node: NodeInfo, requirements: Dict) -> bool:
        """Check if node matches the requirements"""
        specs = node.specs
        
        if requirements.get('min_cpu', 0) > specs.get('cpu', 0):
            return False
        if requirements.get('min_gpu', 0) > specs.get('gpu', 0):
            return False
        if requirements.get('min_ram', 0) > specs.get('ram_gb', 0):
            return False
        if requirements.get('capabilities'):
            if not all(cap in node.capabilities for cap in requirements['capabilities']):
                return False
                
        return True
    
    def _score_node(self, node: NodeInfo) -> float:
        """Score a node based on its capabilities"""
        specs = node.specs
        score = 0
        
        score += specs.get('cpu', 0) * 1.0
        score += specs.get('gpu', 0) * 10.0  # GPUs are more valuable
        score += specs.get('ram_gb', 0) * 0.5
        
        # Bonus for recent activity
        time_since_seen = time.time() - node.last_seen
        if time_since_seen < 60:  # Active in last minute
            score *= 1.2
        
        return score

class NetworkManager:
    """Manages network connections and communication"""
    
    def __init__(self, discovery: NodeDiscovery):
        self.discovery = discovery
        self.connections: Dict[str, asyncio.StreamWriter] = {}
    
    async def connect_to_node(self, node_id: str) -> bool:
        """Establish connection to a specific node"""
        if node_id not in self.discovery.known_nodes:
            return False
        
        node = self.discovery.known_nodes[node_id]
        
        try:
            reader, writer = await asyncio.open_connection(
                node.address, node.port
            )
            
            self.connections[node_id] = writer
            logger.info(f"Connected to node {node_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {node_id}: {e}")
            return False
    
    async def broadcast_message(self, message: Dict):
        """Broadcast a message to all connected nodes"""
        message_json = json.dumps(message)
        
        for node_id, writer in list(self.connections.items()):
            try:
                writer.write(message_json.encode() + b'\n')
                await writer.drain()
            except Exception as e:
                logger.warning(f"Failed to send to {node_id}: {e}")
                # Remove failed connection
                del self.connections[node_id]
    
    async def send_to_node(self, node_id: str, message: Dict) -> bool:
        """Send message to specific node"""
        if node_id not in self.connections:
            if not await self.connect_to_node(node_id):
                return False
        
        try:
            writer = self.connections[node_id]
            message_json = json.dumps(message)
            writer.write(message_json.encode() + b'\n')
            await writer.drain()
            return True
            
        except Exception as e:
            logger.error(f"Failed to send to {node_id}: {e}")
            if node_id in self.connections:
                del self.connections[node_id]
            return False
    
    def disconnect_all(self):
        """Close all connections"""
        for writer in self.connections.values():
            writer.close()
        self.connections.clear()