import json
import datetime
import random
import asyncio
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from pydantic import BaseModel
from .database import engine, get_db, Base, SessionLocal
from .models import Device, DispositionDecision, AuditLog, SystemSetting
from .schemas import DeviceIntakePayload, DeviceResponse, SystemSettingSchema, SystemSettingUpdate, AnalyticsOverview
from .services.rules_service import RulesService
from .services.valuation_service import ValuationService
from .services.agent_service import AgentService
from .services.event_service import EventService

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ReturnsOS API", version="1.0.0")

# Setup CORS to allow React frontend (default Vite port 5173) to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For demo simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Seeding Helper ---
def seed_settings_if_missing(db: Session):
    if not db.query(SystemSetting).filter(SystemSetting.key == "enable_gemini_flow").first():
        db.add(SystemSetting(key="enable_gemini_flow", value="false"))
    if not db.query(SystemSetting).filter(SystemSetting.key == "base_market_values").first():
        db.add(SystemSetting(key="base_market_values", value=json.dumps(ValuationService.BASE_MARKET_VALUES)))
    if not db.query(SystemSetting).filter(SystemSetting.key == "repair_costs").first():
        db.add(SystemSetting(key="repair_costs", value=json.dumps(ValuationService.REPAIR_COSTS)))
    if not db.query(SystemSetting).filter(SystemSetting.key == "grade_multipliers").first():
        db.add(SystemSetting(key="grade_multipliers", value=json.dumps(ValuationService.GRADE_MULTIPLIERS)))
    if not db.query(SystemSetting).filter(SystemSetting.key == "decision_parameters").first():
        db.add(SystemSetting(key="decision_parameters", value=json.dumps(ValuationService.DECISION_PARAMETERS)))
    db.commit()

def seed_database_if_empty(db: Session):
    if db.query(Device).count() > 0:
        return

    # Load dynamic rules for seeder
    base_vals_setting = db.query(SystemSetting).filter(SystemSetting.key == "base_market_values").first()
    rep_costs_setting = db.query(SystemSetting).filter(SystemSetting.key == "repair_costs").first()
    mults_setting = db.query(SystemSetting).filter(SystemSetting.key == "grade_multipliers").first()
    dec_params_setting = db.query(SystemSetting).filter(SystemSetting.key == "decision_parameters").first()
    
    base_vals = json.loads(base_vals_setting.value) if base_vals_setting else None
    rep_costs = json.loads(rep_costs_setting.value) if rep_costs_setting else None
    mults = json.loads(mults_setting.value) if mults_setting else None
    dec_params = json.loads(dec_params_setting.value) if dec_params_setting else None

    # Models list for seeding
    models_pool = [
        ("Apple", "iPhone 15 Pro Max", 950.0),
        ("Apple", "iPhone 15", 700.0),
        ("Apple", "iPhone 14 Pro", 700.0),
        ("Apple", "iPhone 14", 550.0),
        ("Apple", "iPhone 13", 400.0),
        ("Apple", "iPhone 12", 280.0),
        ("Apple", "iPad Pro", 600.0),
    ]

    actions = ["RESELL", "REPAIR", "CANNIBALIZE", "RECYCLE", "LOCK_CLEARANCE"]
    grades = ["A", "B", "C", "D"]

    print("Seeding SQLite database with 75 historical device records...")

    # Generate 75 devices over the last 30 days
    base_time = datetime.datetime.utcnow()
    for i in range(75):
        days_ago = random.randint(0, 30)
        created_at = base_time - datetime.timedelta(days=days_ago, hours=random.randint(0, 23))
        brand, model, base_val = random.choice(models_pool)
        
        # Randomize parameters
        swollen = random.random() < 0.05  # 5% swollen battery
        fmip = "LOCKED" if (random.random() < 0.08) else "UNLOCKED" # 8% locked
        mdm = "LOCKED" if (random.random() < 0.04) else "UNLOCKED"
        bat_health = random.randint(65, 100) if not swollen else random.randint(50, 78)
        
        cosmetic_grade = random.choice(grades)
        functional_grade = random.choice(grades)

        # Build payload representation
        payload = {
            "model": model,
            "brand": brand,
            "serial_number": f"IMEI{1000000000 + i}",
            "locks": {
                "sim_lock": "UNLOCKED",
                "fmip_lock": fmip,
                "mdm_lock": mdm,
                "carrier_lock": "UNLOCKED"
            },
            "battery": {
                "health": bat_health,
                "swollen": swollen
            },
            "cosmetic": {
                "screen": "NONE" if cosmetic_grade == "A" else ("SCRATCHES" if cosmetic_grade == "B" else "CRACKS"),
                "back_glass": "NONE" if cosmetic_grade in ["A", "B"] else "SCRATCHES",
                "frame": "NONE" if cosmetic_grade == "A" else "DENTS",
                "camera_lens": "NONE"
            },
            "functional": {
                "display_burn": functional_grade == "C",
                "display_dead_pixel": False,
                "display_lcd_damage": functional_grade == "D",
                "display_touch_fail": functional_grade == "D",
                "sensor_gyro": False,
                "sensor_light": False,
                "sensor_proximity": False,
                "sensor_haptics": False,
                "button_volume": False,
                "button_lock": False,
                "button_silent": False,
                "button_home": False,
                "camera_front_fail": False,
                "camera_rear_fail": False,
                "camera_autofocus_fail": False,
                "audio_speaker_fail": False,
                "audio_mic_fail": False,
                "audio_receiver_fail": False,
                "conn_wifi_fail": False,
                "conn_nfc_fail": False,
                "conn_wireless_charge_fail": False
            }
        }

        # Run engines
        grading = RulesService.evaluate_device(payload)
        valuation = ValuationService.determine_optimal_recovery(
            payload, 
            grading,
            custom_base_values=base_vals,
            custom_repair_costs=rep_costs,
            custom_multipliers=mults,
            custom_decision_params=dec_params
        )

        # Create Device Model
        db_device = Device(
            serial_number=payload["serial_number"],
            model=model,
            brand=brand,
            sim_lock="UNLOCKED",
            fmip_lock=fmip,
            mdm_lock=mdm,
            carrier_lock="UNLOCKED",
            battery_health=bat_health,
            battery_swollen=swollen,
            cosmetic_grade=grading["breakdown"]["Cosmetic"],
            cosmetic_details=json.dumps(payload["cosmetic"]),
            functional_grade=grading["breakdown"]["Functional"],
            functional_details=json.dumps(payload["functional"]),
            status="DECIDED",
            created_at=created_at
        )
        db.add(db_device)
        db.commit()
        db.refresh(db_device)

        # Generate agent logs
        agent_logs = AgentService.generate_mock_agent_logs(payload, grading, valuation)

        # Create Decision
        db_decision = DispositionDecision(
            device_id=db_device.id,
            recommended_action=valuation["optimal_action"],
            confidence=0.88 + random.randint(0, 10)/100.0,
            estimated_recovery_value=valuation["estimated_recovery"],
            reasoning_json=json.dumps(agent_logs),
            final_grade=grading["final_grade"],
            is_gemini_processed=False,
            created_at=created_at
        )
        db.add(db_decision)
        db.commit()
        db.refresh(db_decision)

        # Save Audit Logs
        for log in agent_logs:
            db_log = AuditLog(
                decision_id=db_decision.id,
                agent_name=log["agent_name"],
                status=log["status"],
                message=log["message"],
                created_at=created_at
            )
            db.add(db_log)
        db.commit()


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_settings_if_missing(db)
        seed_database_if_empty(db)
    finally:
        db.close()

# --- API Routes ---

@app.get("/api/settings", response_model=List[SystemSettingSchema])
def get_settings(db: Session = Depends(get_db)):
    return db.query(SystemSetting).all()

@app.post("/api/settings/{key}")
def update_setting(key: str, payload: SystemSettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key, value=payload.value)
        db.add(setting)
    else:
        setting.value = payload.value
    db.commit()
    return {"key": key, "value": payload.value}

@app.get("/api/events")
async def sse_endpoint():
    """
    Server-Sent Events endpoint to stream real-time events.
    """
    queue = EventService.register_client()
    
    async def event_generator():
        try:
            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            EventService.unregister_client(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/intake")
async def device_intake(payload: DeviceIntakePayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Rules Grading & Exceptions
    grading = RulesService.evaluate_device(payload.dict())
    
    # Load dynamic rules from settings
    base_vals_setting = db.query(SystemSetting).filter(SystemSetting.key == "base_market_values").first()
    rep_costs_setting = db.query(SystemSetting).filter(SystemSetting.key == "repair_costs").first()
    mults_setting = db.query(SystemSetting).filter(SystemSetting.key == "grade_multipliers").first()
    dec_params_setting = db.query(SystemSetting).filter(SystemSetting.key == "decision_parameters").first()
    
    base_vals = json.loads(base_vals_setting.value) if base_vals_setting else None
    rep_costs = json.loads(rep_costs_setting.value) if rep_costs_setting else None
    mults = json.loads(mults_setting.value) if mults_setting else None
    dec_params = json.loads(dec_params_setting.value) if dec_params_setting else None

    # 2. Valuation Engine Calculations
    valuation = ValuationService.determine_optimal_recovery(
        payload.dict(), 
        grading,
        custom_base_values=base_vals,
        custom_repair_costs=rep_costs,
        custom_multipliers=mults,
        custom_decision_params=dec_params
    )
    
    # Check if Gemini is enabled in system settings
    gemini_setting = db.query(SystemSetting).filter(SystemSetting.key == "enable_gemini_flow").first()
    enable_gemini = gemini_setting.value == "true" if gemini_setting else False
    
    recommended_action = valuation["optimal_action"]
    confidence = 0.95
    estimated_recovery = valuation["estimated_recovery"]
    agent_logs = []
    is_gemini_processed = False

    if enable_gemini:
        # Call Gemini API
        gemini_res = AgentService.query_gemini_api(payload.dict(), grading, valuation)
        if not gemini_res.get("use_fallback", False):
            # Gemini succeeded! Parse and enforce rules validation (disposition override checks)
            rec_action = gemini_res["recommended_action"]
            
            # CRITICAL RULES VALIDATION (Disposition checks)
            # If battery swollen, recommendation must be RECYCLE
            if grading["is_safety_exception"]:
                rec_action = "RECYCLE"
                recycle_price = dec_params.get("recycle_price", 15.0) if dec_params else 15.0
                estimated_recovery = recycle_price
            # If locks active, recommendation must follow rules engine optimal lock action
            elif grading["is_lock_exception"]:
                rec_action = valuation["optimal_action"]
                estimated_recovery = valuation["estimated_recovery"]
            else:
                estimated_recovery = gemini_res["estimated_recovery"]
                
            recommended_action = rec_action
            confidence = gemini_res["confidence"]
            agent_logs = gemini_res["logs"]
            is_gemini_processed = True
            
    if not is_gemini_processed or not enable_gemini:
        # Generate rules engine/mock logs
        agent_logs = AgentService.generate_mock_agent_logs(payload.dict(), grading, valuation)
        confidence = 0.90 + random.randint(0, 9)/100.0

    # Save to SQLite database
    # Check for duplicate serial number
    existing_device = db.query(Device).filter(Device.serial_number == payload.serial_number).first()
    if existing_device:
        raise HTTPException(status_code=400, detail="Device with this IMEI/Serial Number already exists.")

    db_device = Device(
        serial_number=payload.serial_number,
        model=payload.model,
        brand=payload.brand,
        sim_lock=payload.locks.sim_lock,
        fmip_lock=payload.locks.fmip_lock,
        mdm_lock=payload.locks.mdm_lock,
        carrier_lock=payload.locks.carrier_lock,
        battery_health=payload.battery.health,
        battery_swollen=payload.battery.swollen,
        cosmetic_grade=grading["breakdown"]["Cosmetic"],
        cosmetic_details=json.dumps(payload.cosmetic.dict()),
        functional_grade=grading["breakdown"]["Functional"],
        functional_details=json.dumps(payload.functional.dict()),
        status="DECIDED"
    )
    db.add(db_device)
    db.commit()
    db.refresh(db_device)

    db_decision = DispositionDecision(
        device_id=db_device.id,
        recommended_action=recommended_action,
        confidence=confidence,
        estimated_recovery_value=estimated_recovery,
        reasoning_json=json.dumps(agent_logs),
        final_grade=grading["final_grade"],
        is_gemini_processed=is_gemini_processed
    )
    db.add(db_decision)
    db.commit()
    db.refresh(db_decision)

    # Save Audits
    for log in agent_logs:
        db_log = AuditLog(
            decision_id=db_decision.id,
            agent_name=log["agent_name"],
            status=log["status"],
            message=log["message"]
        )
        db.add(db_log)
    db.commit()

    # Trigger async event pipeline simulation
    background_tasks.add_task(
        EventService.simulate_device_processing_pipeline,
        db_device.id,
        payload.dict(),
        grading,
        {
            "base_market_value": valuation["base_market_value"],
            "repair_cost": valuation["repair_cost"],
            "estimated_recovery": estimated_recovery,
            "optimal_action": recommended_action,
            "reasoning": valuation["reasoning"],
            "rvp": (estimated_recovery / valuation["base_market_value"]) * 100
        }
    )

    return {"device_id": db_device.id, "status": "processing"}

@app.get("/api/devices", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    return db.query(Device).order_by(Device.created_at.desc()).all()

@app.get("/api/devices/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@app.get("/api/analytics", response_model=AnalyticsOverview)
def get_analytics(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    decisions = db.query(DispositionDecision).all()
    
    total = len(devices)
    if total == 0:
        return AnalyticsOverview(
            total_processed=0, avg_rvp=0.0, avg_processing_time_sec=0.0, manual_review_count=0,
            disposition_breakdown={}, grade_breakdown={}, exception_breakdown={}, recovery_trend=[]
        )

    # Calculate average RVP
    total_rvp = 0.0
    manual_reviews = 0
    dispositions = {}
    grades = {}
    exceptions = {"safety": 0, "locks": 0}

    for d in decisions:
        # Find base value from database records
        base_val = ValuationService.get_base_value(d.device.model)
        rvp = (d.estimated_recovery_value / base_val) * 100 if base_val > 0 else 0
        total_rvp += rvp
        
        dispositions[d.recommended_action] = dispositions.get(d.recommended_action, 0) + 1
        grades[d.final_grade] = grades.get(d.final_grade, 0) + 1
        
        if d.recommended_action in ["LOCK_CLEARANCE", "RECYCLE"]:
            manual_reviews += 1
            
        if d.device.battery_swollen:
            exceptions["safety"] += 1
        if d.device.fmip_lock == "LOCKED" or d.device.mdm_lock == "LOCKED":
            exceptions["locks"] += 1

    avg_rvp = total_rvp / len(decisions) if decisions else 0.0

    # Group by date for trends (last 7 days)
    today = datetime.datetime.utcnow().date()
    trend_dict = {}
    for i in range(7):
        d = today - datetime.timedelta(days=i)
        trend_dict[d.isoformat()] = {"count": 0, "value": 0.0}

    for dec in decisions:
        date_str = dec.created_at.date().isoformat()
        if date_str in trend_dict:
            trend_dict[date_str]["count"] += 1
            trend_dict[date_str]["value"] += dec.estimated_recovery_value

    trend = [{"date": k, "count": v["count"], "value": round(v["value"], 2)} for k, v in sorted(trend_dict.items())]

    return AnalyticsOverview(
        total_processed=total,
        avg_rvp=round(avg_rvp, 1),
        avg_processing_time_sec=8.4,  # Simulated average processing speed
        manual_review_count=manual_reviews,
        disposition_breakdown=dispositions,
        grade_breakdown=grades,
        exception_breakdown=exceptions,
        recovery_trend=trend
    )

class DecisionActionPayload(BaseModel):
    action: str
    status: str
    notes: Optional[str] = None

@app.post("/api/devices/{device_id}/action")
def update_device_action(device_id: int, payload: DecisionActionPayload, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.status = payload.status
    if device.decision:
        device.decision.recommended_action = payload.action
        
        # Recalculate estimated recovery value for overridden action!
        base_vals_setting = db.query(SystemSetting).filter(SystemSetting.key == "base_market_values").first()
        rep_costs_setting = db.query(SystemSetting).filter(SystemSetting.key == "repair_costs").first()
        mults_setting = db.query(SystemSetting).filter(SystemSetting.key == "grade_multipliers").first()
        dec_params_setting = db.query(SystemSetting).filter(SystemSetting.key == "decision_parameters").first()
        
        custom_base_vals = json.loads(base_vals_setting.value) if base_vals_setting else None
        custom_rep_costs = json.loads(rep_costs_setting.value) if rep_costs_setting else None
        custom_mults = json.loads(mults_setting.value) if mults_setting else None
        custom_dec_params = json.loads(dec_params_setting.value) if dec_params_setting else None
        
        grading = {
            "final_grade": device.decision.final_grade,
            "is_safety_exception": device.battery_swollen,
            "is_lock_exception": device.fmip_lock == "LOCKED" or device.mdm_lock == "LOCKED"
        }
        
        device_payload = {
            "model": device.model,
            "brand": device.brand,
            "serial_number": device.serial_number,
            "locks": {
                "sim_lock": device.sim_lock,
                "fmip_lock": device.fmip_lock,
                "mdm_lock": device.mdm_lock,
                "carrier_lock": device.carrier_lock
            },
            "battery": {
                "health": device.battery_health,
                "swollen": device.battery_swollen
            },
            "cosmetic": json.loads(device.cosmetic_details) if device.cosmetic_details else {},
            "functional": json.loads(device.functional_details) if device.functional_details else {}
        }
        
        valuation = ValuationService.determine_optimal_recovery(
            device_payload, grading,
            custom_base_vals, custom_rep_costs, custom_mults, custom_dec_params
        )
        chosen_action = payload.action
        chosen_recovery = valuation.get("options", {}).get(chosen_action, valuation["estimated_recovery"])
        device.decision.estimated_recovery_value = chosen_recovery
        
        # Log supervisor action to audit logs
        db_log = AuditLog(
            decision_id=device.decision.id,
            agent_name="Supervisor Audit",
            status="PASSED" if payload.status == "COMPLETED" else "WARNING",
            message=f"Supervisor marked action as {payload.status}. Final disposition: {payload.action}. Notes: {payload.notes or 'None'}."
        )
        db.add(db_log)
    db.commit()
    return {"status": "success", "device_status": device.status}

