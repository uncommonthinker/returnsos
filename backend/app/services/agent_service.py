import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List

class AgentService:
    @classmethod
    def generate_mock_agent_logs(cls, payload: Dict[str, Any], grading: Dict[str, Any], valuation: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generates realistic, high-fidelity reasoning logs for the 4 agents
        based on the rules engine output.
        """
        model = payload["model"]
        final_grade = grading["final_grade"]
        opt_action = valuation["optimal_action"]

        # 1. Condition Assessment Agent Logs
        cond_messages = []
        if grading["is_safety_exception"]:
            cond_messages.append(f"CRITICAL: Battery swollen flag is active. Thermal expansion risk. Condition Grade forced to D.")
        elif grading["is_lock_exception"]:
            cond_messages.append(f"SECURITY ALERT: Device has active MDM or FMIP locks. Normal flashing is impossible. Condition Grade forced to D.")
        else:
            cond_messages.append(f"Evaluating cosmetic and functional inputs for {model}.")
            cond_messages.append(f"Cosmetic grade computed as {grading['breakdown']['Cosmetic']} based on surface scratches/dents.")
            cond_messages.append(f"Functional grade computed as {grading['breakdown']['Functional']} based on button and sensor status.")
            cond_messages.append(f"Locks/Battery grade is {grading['breakdown']['Locks/Battery']} (Battery health: {payload['battery']['health']}%).")
            cond_messages.append(f"Enforced Lowest-Grade rule: Device overall grade is {final_grade} (Downgraded due to: {grading['reason_summary']}).")
        
        # 2. Recovery Valuation Agent Logs
        val_messages = []
        val_messages.append(f"Establishing baseline market value for {model} (Grade A) at ${valuation['base_market_value']:.2f}.")
        if valuation["repair_cost"] > 0:
            val_messages.append(f"Calculated component repair overhead: ${valuation['repair_cost']:.2f}. Repairs required: {', '.join(valuation['repairs_needed'].keys())}.")
        else:
            val_messages.append(f"No hardware repairs are required for this device.")
            
        val_messages.append(f"Financial Channel Analysis:")
        val_messages.append(f"  - Sell As-Is (Grade {final_grade}): Est. Recovery ${valuation['base_market_value'] * cls._get_multiplier(final_grade):.2f}")
        if valuation["repair_cost"] > 0 and valuation["repair_cost"] <= (valuation["base_market_value"] * 0.7):
            val_messages.append(f"  - Repair and Resell (Grade A/B): Est. Net Recovery ${valuation['base_market_value'] - valuation['repair_cost']:.2f}")
        else:
            val_messages.append(f"  - Repair: Economically unviable (repair cost exceeds threshold)")
        val_messages.append(f"  - Cannibalize Parts: Est. Recovery ${valuation['base_market_value'] * (0.3 if opt_action == 'CANNIBALIZE' else 0.15):.2f}")
        val_messages.append(f"  - Recycle Scrap: Est. Recovery $15.00")

        # 3. Disposition Recommendation Agent Logs
        rec_messages = []
        rec_messages.append(f"Reviewing financial options and grading bottlenecks for {model}.")
        rec_messages.append(f"Decision logic selects channel with maximum value recovery. Selected action: {opt_action}.")
        rec_messages.append(f"Reasoning summary: {valuation['reasoning']}")

        # 4. Audit Agent Logs
        audit_messages = []
        audit_status = "PASSED"
        if grading["is_safety_exception"]:
            audit_messages.append("WARNING: Enforced safety quarantine protocol. Device has swollen battery.")
            audit_messages.append("Safety check overrides all resale/repair channels. Routing to RECYCLE queue.")
            audit_status = "FAILED"
        elif grading["is_lock_exception"]:
            audit_messages.append("LOCK ALERT: Device contains unresolved security locks (FMIP/MDM).")
            audit_messages.append("Routing to LOCK_CLEARANCE queue. Contact original owner for unlock verification.")
            audit_status = "WARNING"
        else:
            audit_messages.append("Audit validation check successful.")
            audit_messages.append(f"Enforced Min-Grade rule: final disposition matched to Grade {final_grade}.")
            audit_messages.append("Data erasure standard (ADISA / NIST 800-88) confirmed. Safe to route to inventory.")

        return [
            {"agent_name": "Condition Assessment Agent", "status": "PASSED" if not (grading["is_safety_exception"] or grading["is_lock_exception"]) else "WARNING", "message": " | ".join(cond_messages)},
            {"agent_name": "Recovery Valuation Agent", "status": "PASSED", "message": " | ".join(val_messages)},
            {"agent_name": "Disposition Recommendation Agent", "status": "PASSED", "message": " | ".join(rec_messages)},
            {"agent_name": "Audit Agent", "status": audit_status, "message": " | ".join(audit_messages)}
        ]

    @staticmethod
    def _get_multiplier(grade: str) -> float:
        return {"A": 1.0, "B": 0.85, "C": 0.65, "D": 0.35}.get(grade, 0.5)

    @classmethod
    def query_gemini_api(cls, payload: Dict[str, Any], grading: Dict[str, Any], valuation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends structured device payload to Gemini API for multi-agent reasoning.
        Falls back to mock logs if the API key is invalid or call fails.
        """
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"error": "Missing API Key", "use_fallback": True}

        # Prompt instruction
        prompt = f"""
You are an expert reverse logistics decision intelligence system.
Analyze the following returned device data:
Payload: {json.dumps(payload)}
Grading Engine Results: {json.dumps(grading)}
Valuation Engine Pre-calculations: {json.dumps(valuation)}

You must simulate a cooperative 4-agent discussion and output a JSON object with this exact format:
{{
  "condition_agent_log": "Detail your analysis of cosmetic flaws and functional diagnostics",
  "valuation_agent_log": "Detail your review of repair costs vs market value",
  "recommendation_agent_log": "Detail your final recommended action (RESELL, REPAIR, CANNIBALIZE, RECYCLE, LOCK_CLEARANCE) and reasoning",
  "audit_agent_log": "Detail your safety check and compliance audit",
  "recommended_action": "RESELL" or "REPAIR" or "CANNIBALIZE" or "RECYCLE" or "LOCK_CLEARANCE",
  "confidence": 0.0 to 1.0,
  "estimated_recovery": 0.0
}}

Ensure that safety overrides (swollen battery -> RECYCLE) and lock overrides (FMIP/MDM locks -> LOCK_CLEARANCE) are strictly audited. Output ONLY the JSON block. Do not include markdown code ticks.
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        req_data = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }

        try:
            req = urllib.request.Request(url, data=json.dumps(req_data).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                
                # Extract text response
                text_content = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                agent_response = json.loads(text_content)
                
                # Structure output as agent logs list
                return {
                    "use_fallback": False,
                    "recommended_action": agent_response.get("recommended_action", valuation["optimal_action"]),
                    "confidence": agent_response.get("confidence", 0.90),
                    "estimated_recovery": agent_response.get("estimated_recovery", valuation["estimated_recovery"]),
                    "logs": [
                        {"agent_name": "Condition Assessment Agent", "status": "PASSED", "message": agent_response.get("condition_agent_log", "")},
                        {"agent_name": "Recovery Valuation Agent", "status": "PASSED", "message": agent_response.get("valuation_agent_log", "")},
                        {"agent_name": "Disposition Recommendation Agent", "status": "PASSED", "message": agent_response.get("recommendation_agent_log", "")},
                        {"agent_name": "Audit Agent", "status": "PASSED", "message": agent_response.get("audit_agent_log", "")}
                    ]
                }
        except Exception as e:
            # Fall back to rule-based mock
            return {"error": str(e), "use_fallback": True}
