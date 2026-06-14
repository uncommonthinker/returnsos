import asyncio
import uuid
import datetime
import json
from typing import Dict, Any, List

class EventService:
    # A list of active client queues
    _listeners: List[asyncio.Queue] = []

    @classmethod
    def register_client(cls) -> asyncio.Queue:
        """
        Registers a new client session (SSE listener)
        """
        queue = asyncio.Queue()
        cls._listeners.append(queue)
        return queue

    @classmethod
    def unregister_client(cls, queue: asyncio.Queue):
        """
        Removes a client session on disconnect
        """
        if queue in cls._listeners:
            cls._listeners.remove(queue)

    @classmethod
    def emit_event(cls, topic: str, data: Dict[str, Any]):
        """
        Formats and broadcasts an event to all connected listeners.
        """
        event = {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "topic": topic,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "data": data
        }
        
        # Format as Server-Sent Event (SSE)
        sse_message = f"event: {topic}\ndata: {json.dumps(event)}\n\n"
        
        # Put in all listener queues
        for queue in cls._listeners:
            asyncio.create_task(queue.put(sse_message))

    @classmethod
    async def simulate_device_processing_pipeline(cls, device_id: int, payload: Dict[str, Any], grading: Dict[str, Any], valuation: Dict[str, Any]):
        """
        Asynchronously simulates the flow of a device record through
        the message broker topics, with 1-second delays between stages.
        """
        # 1. Device Received Event
        cls.emit_event("device.received", {
            "device_id": device_id,
            "serial_number": payload["serial_number"],
            "model": payload["model"],
            "brand": payload["brand"]
        })
        await asyncio.sleep(1.0)

        # 2. Testing Completed Event
        cls.emit_event("testing.completed", {
            "device_id": device_id,
            "cosmetic_grade": grading["breakdown"]["Cosmetic"],
            "functional_grade": grading["breakdown"]["Functional"],
            "battery_health": payload["battery"]["health"],
            "battery_swollen": payload["battery"]["swollen"],
            "locks": payload["locks"]
        })
        await asyncio.sleep(1.0)

        # 3. Valuation Updated Event
        cls.emit_event("valuation.updated", {
            "device_id": device_id,
            "base_market_value": valuation["base_market_value"],
            "repair_cost": valuation["repair_cost"],
            "estimated_recovery": valuation["estimated_recovery"],
            "rvp": valuation["rvp"]
        })
        await asyncio.sleep(1.0)

        # 4. Decision Pending (AI Engine Processing) Event
        cls.emit_event("decision.pending", {
            "device_id": device_id,
            "proposed_action": valuation["optimal_action"],
            "confidence": 0.85 + (device_id % 15) / 100.0, # Visual mock variation
            "reasoning": valuation["reasoning"]
        })
        await asyncio.sleep(1.0)

        # 5. Decision Audited & Approved Event
        cls.emit_event("decision.audited", {
            "device_id": device_id,
            "final_action": valuation["optimal_action"],
            "final_grade": grading["final_grade"],
            "audited": True,
            "audit_status": "APPROVED",
            "audit_notes": f"Rule check completed. Reason: {grading['reason_summary']}"
        })
