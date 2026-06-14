from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime

class SystemSettingSchema(BaseModel):
    key: str
    value: str
    class Config:
        from_attributes = True

class SystemSettingUpdate(BaseModel):
    value: str

# Questionnaire sub-items
class LocksQuestionnaire(BaseModel):
    sim_lock: str  # LOCKED / UNLOCKED
    fmip_lock: str  # LOCKED / UNLOCKED
    mdm_lock: str  # LOCKED / UNLOCKED
    carrier_lock: str  # LOCKED / UNLOCKED

class BatteryQuestionnaire(BaseModel):
    health: int
    swollen: bool

class CosmeticQuestionnaire(BaseModel):
    screen: str  # NONE / SCRATCHES / CRACKS / DIGS
    back_glass: str  # NONE / SCRATCHES / CRACKS
    frame: str  # NONE / DENTS / DIGS / MISSING_PARTS
    camera_lens: str  # NONE / DUST / CRACKS

class FunctionalQuestionnaire(BaseModel):
    # Display: Screen Burn, Dead Pixel, LCD Damage, Touch Screen
    display_burn: bool
    display_dead_pixel: bool
    display_lcd_damage: bool
    display_touch_fail: bool
    
    # Sensors: Accelerometer, Gyroscope, Ambient Light, Proximity, Haptics
    sensor_gyro: bool
    sensor_light: bool
    sensor_proximity: bool
    sensor_haptics: bool
    
    # Buttons: Volume, Lock, Silent, Home
    button_volume: bool
    button_lock: bool
    button_silent: bool
    button_home: bool
    
    # Cameras: Front (Normal/Wide), Rear (Normal/Wide), Auto Focus
    camera_front_fail: bool
    camera_rear_fail: bool
    camera_autofocus_fail: bool
    
    # Audio: Speaker, Mic, Receiver, Headphone Jack
    audio_speaker_fail: bool
    audio_mic_fail: bool
    audio_receiver_fail: bool
    
    # Connectivity: WiFi, Bluetooth, NFC, Wireless Charging
    conn_wifi_fail: bool
    conn_nfc_fail: bool
    conn_wireless_charge_fail: bool

class DeviceIntakePayload(BaseModel):
    serial_number: str
    model: str
    brand: str
    locks: LocksQuestionnaire
    battery: BatteryQuestionnaire
    cosmetic: CosmeticQuestionnaire
    functional: FunctionalQuestionnaire

class AuditLogResponse(BaseModel):
    id: int
    agent_name: str
    status: str
    message: str
    created_at: datetime
    class Config:
        from_attributes = True

class DecisionResponse(BaseModel):
    id: int
    device_id: int
    recommended_action: str
    confidence: float
    estimated_recovery_value: float
    reasoning_json: Optional[str]
    final_grade: str
    is_gemini_processed: bool
    created_at: datetime
    audit_logs: List[AuditLogResponse] = []
    class Config:
        from_attributes = True

class DeviceResponse(BaseModel):
    id: int
    serial_number: str
    model: str
    brand: str
    sim_lock: str
    fmip_lock: str
    mdm_lock: str
    carrier_lock: str
    battery_health: int
    battery_swollen: bool
    cosmetic_grade: str
    cosmetic_details: Optional[str]
    functional_grade: str
    functional_details: Optional[str]
    status: str
    created_at: datetime
    decision: Optional[DecisionResponse] = None
    class Config:
        from_attributes = True

class EventDataSchema(BaseModel):
    event_id: str
    topic: str
    timestamp: str
    data: Dict[str, Any]

class AnalyticsOverview(BaseModel):
    total_processed: int
    avg_rvp: float
    avg_processing_time_sec: float
    manual_review_count: int
    disposition_breakdown: Dict[str, int]
    grade_breakdown: Dict[str, int]
    exception_breakdown: Dict[str, int]
    recovery_trend: List[Dict[str, Any]]
