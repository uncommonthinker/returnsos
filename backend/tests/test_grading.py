import sys
import os

# Add parent directory to path to enable app imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.rules_service import RulesService
from app.services.valuation_service import ValuationService

def test_perfect_device_grading():
    payload = {
        "model": "iPhone 14 Pro",
        "brand": "Apple",
        "serial_number": "IMEI12345",
        "locks": {"sim_lock": "UNLOCKED", "fmip_lock": "UNLOCKED", "mdm_lock": "UNLOCKED", "carrier_lock": "UNLOCKED"},
        "battery": {"health": 92, "swollen": False},
        "cosmetic": {"screen": "NONE", "back_glass": "NONE", "frame": "NONE", "camera_lens": "NONE"},
        "functional": {
            "display_burn": False, "display_dead_pixel": False, "display_lcd_damage": False, "display_touch_fail": False,
            "sensor_gyro": False, "sensor_light": False, "sensor_proximity": False, "sensor_haptics": False,
            "button_volume": False, "button_lock": False, "button_silent": False, "button_home": False,
            "camera_front_fail": False, "camera_rear_fail": False, "camera_autofocus_fail": False,
            "audio_speaker_fail": False, "audio_mic_fail": False, "audio_receiver_fail": False,
            "conn_wifi_fail": False, "conn_nfc_fail": False, "conn_wireless_charge_fail": False
        }
    }
    
    grading = RulesService.evaluate_device(payload)
    assert grading["final_grade"] == "A"
    assert not grading["is_safety_exception"]
    assert not grading["is_lock_exception"]
    
    valuation = ValuationService.determine_optimal_recovery(payload, grading)
    assert valuation["optimal_action"] == "RESELL"
    assert valuation["estimated_recovery"] == 700.0  # Grade A base for 14 Pro
    assert valuation["repair_cost"] == 0.0

def test_lowest_grade_rule_compliance():
    # Cosmetic is C, Functional is D, Locks is A. Final should be D.
    payload = {
        "model": "iPhone 13",
        "brand": "Apple",
        "serial_number": "IMEI54321",
        "locks": {"sim_lock": "UNLOCKED", "fmip_lock": "UNLOCKED", "mdm_lock": "UNLOCKED", "carrier_lock": "UNLOCKED"},
        "battery": {"health": 85, "swollen": False},
        "cosmetic": {"screen": "SCRATCHES", "back_glass": "NONE", "frame": "DENTS", "camera_lens": "NONE"}, # C
        "functional": {
            "display_burn": False, "display_dead_pixel": False, "display_lcd_damage": True, "display_touch_fail": False, # D (LCD Damage)
            "sensor_gyro": False, "sensor_light": False, "sensor_proximity": False, "sensor_haptics": False,
            "button_volume": False, "button_lock": False, "button_silent": False, "button_home": False,
            "camera_front_fail": False, "camera_rear_fail": False, "camera_autofocus_fail": False,
            "audio_speaker_fail": False, "audio_mic_fail": False, "audio_receiver_fail": False,
            "conn_wifi_fail": False, "conn_nfc_fail": False, "conn_wireless_charge_fail": False
        }
    }
    
    grading = RulesService.evaluate_device(payload)
    assert grading["final_grade"] == "D"
    assert "Functional is D" in grading["reason_summary"]
    
    valuation = ValuationService.determine_optimal_recovery(payload, grading)
    # Market value is 400. Repair display cost is 120. Repaired recovery is 400-120 = 280.
    # Sell as-is in D is 400 * 0.35 = 140. Cannibalize is 400 * 0.3 = 120.
    # So REPAIR is the optimal action yielding $280!
    assert valuation["optimal_action"] == "REPAIR"
    assert valuation["estimated_recovery"] == 280.0
    assert valuation["repair_cost"] == 120.0

def test_safety_battery_override():
    payload = {
        "model": "iPhone 12",
        "brand": "Apple",
        "serial_number": "IMEI11111",
        "locks": {"sim_lock": "UNLOCKED", "fmip_lock": "UNLOCKED", "mdm_lock": "UNLOCKED", "carrier_lock": "UNLOCKED"},
        "battery": {"health": 70, "swollen": True}, # Safety exception
        "cosmetic": {"screen": "NONE", "back_glass": "NONE", "frame": "NONE", "camera_lens": "NONE"},
        "functional": {
            "display_burn": False, "display_dead_pixel": False, "display_lcd_damage": False, "display_touch_fail": False,
            "sensor_gyro": False, "sensor_light": False, "sensor_proximity": False, "sensor_haptics": False,
            "button_volume": False, "button_lock": False, "button_silent": False, "button_home": False,
            "camera_front_fail": False, "camera_rear_fail": False, "camera_autofocus_fail": False,
            "audio_speaker_fail": False, "audio_mic_fail": False, "audio_receiver_fail": False,
            "conn_wifi_fail": False, "conn_nfc_fail": False, "conn_wireless_charge_fail": False
        }
    }
    
    grading = RulesService.evaluate_device(payload)
    assert grading["final_grade"] == "D"
    assert grading["is_safety_exception"]
    
    valuation = ValuationService.determine_optimal_recovery(payload, grading)
    assert valuation["optimal_action"] == "RECYCLE"
    assert valuation["estimated_recovery"] == 15.0 # Scrap recycle price

def test_activation_lock_override():
    payload = {
        "model": "iPhone 14 Pro Max",
        "brand": "Apple",
        "serial_number": "IMEI22222",
        "locks": {"sim_lock": "UNLOCKED", "fmip_lock": "LOCKED", "mdm_lock": "UNLOCKED", "carrier_lock": "UNLOCKED"}, # Locked exception
        "battery": {"health": 88, "swollen": False},
        "cosmetic": {"screen": "NONE", "back_glass": "NONE", "frame": "NONE", "camera_lens": "NONE"},
        "functional": {
            "display_burn": False, "display_dead_pixel": False, "display_lcd_damage": False, "display_touch_fail": False,
            "sensor_gyro": False, "sensor_light": False, "sensor_proximity": False, "sensor_haptics": False,
            "button_volume": False, "button_lock": False, "button_silent": False, "button_home": False,
            "camera_front_fail": False, "camera_rear_fail": False, "camera_autofocus_fail": False,
            "audio_speaker_fail": False, "audio_mic_fail": False, "audio_receiver_fail": False,
            "conn_wifi_fail": False, "conn_nfc_fail": False, "conn_wireless_charge_fail": False
        }
    }
    
    grading = RulesService.evaluate_device(payload)
    assert grading["final_grade"] == "D"
    assert grading["is_lock_exception"]
    
    valuation = ValuationService.determine_optimal_recovery(payload, grading)
    assert valuation["optimal_action"] == "LOCK_CLEARANCE"
    # Lock clearance of 14 Pro Max is base 800 - lock clearance cost 10 - repair cost 0 = 790.0
    assert valuation["estimated_recovery"] == 790.0

if __name__ == "__main__":
    test_perfect_device_grading()
    test_lowest_grade_rule_compliance()
    test_safety_battery_override()
    test_activation_lock_override()
    print("All grading rules unit tests passed successfully!")
