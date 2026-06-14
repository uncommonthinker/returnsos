from typing import Dict, Any, Tuple, List

class RulesService:
    @staticmethod
    def calculate_cosmetic_grade(cosmetic: Dict[str, str]) -> Tuple[str, List[str]]:
        """
        Determines cosmetic grade based on rules:
        - CRACKS or MISSING_PARTS -> D
        - DUST, DENTS, DIGS -> C
        - SCRATCHES -> B
        - NONE -> A
        """
        reasons = []
        screen = cosmetic.get("screen", "NONE")
        back_glass = cosmetic.get("back_glass", "NONE")
        frame = cosmetic.get("frame", "NONE")
        camera_lens = cosmetic.get("camera_lens", "NONE")

        # Check for Grade D indicators
        if "CRACKS" in [screen, back_glass, camera_lens] or frame == "MISSING_PARTS":
            if screen == "CRACKS": reasons.append("Cracked Screen")
            if back_glass == "CRACKS": reasons.append("Cracked Back Glass")
            if camera_lens == "CRACKS": reasons.append("Cracked Camera Lens")
            if frame == "MISSING_PARTS": reasons.append("Missing Parts on Frame")
            return "D", reasons

        # Check for Grade C indicators
        if "DIGS" in [screen, frame] or frame == "DENTS" or camera_lens == "DUST" or "SCRATCHES" in [screen, back_glass]:
            # User specified scratches as C or B depending, let's treat scratches as C if heavy, or let's follow user guidelines:
            # "if Cosmetic - A, Functional - C..."
            # Let's say screen/back scratches -> C, frame dents/digs -> C, lens dust -> C.
            if screen == "SCRATCHES": reasons.append("Screen Scratches")
            if back_glass == "SCRATCHES": reasons.append("Back Glass Scratches")
            if frame == "DENTS": reasons.append("Frame Dents")
            if frame == "DIGS": reasons.append("Frame Digs")
            if screen == "DIGS": reasons.append("Screen Digs")
            if camera_lens == "DUST": reasons.append("Dust in Camera Lens")
            return "C", reasons

        # Check for Grade B indicators
        # Frame minor scratches or minor wear
        if "SCRATCHES" in [frame]:
            reasons.append("Minor Frame Scratches")
            return "B", reasons

        return "A", ["Cosmetics are Like New"]

    @staticmethod
    def calculate_functional_grade(functional: Dict[str, bool]) -> Tuple[str, List[str]]:
        """
        Determines functional grade based on rules:
        - Critical failures (LCD damage, Touch screen fail, Cameras fail, Core Audio/Wi-Fi fail) -> D
        - Minor failures (Dead pixel, Screen burn, buttons fail, wireless charging/NFC fail, haptics fail) -> C
        - Sensor failures (Gyro, light, proximity) -> B
        - All pass -> A
        """
        reasons = []
        
        # Grade D (Critical failures)
        if (functional.get("display_lcd_damage", False) or 
            functional.get("display_touch_fail", False) or 
            functional.get("camera_front_fail", False) or 
            functional.get("camera_rear_fail", False) or 
            functional.get("audio_speaker_fail", False) or 
            functional.get("audio_mic_fail", False) or 
            functional.get("conn_wifi_fail", False)):
            
            if functional.get("display_lcd_damage", False): reasons.append("LCD Damage")
            if functional.get("display_touch_fail", False): reasons.append("Touch Screen Failure")
            if functional.get("camera_front_fail", False): reasons.append("Front Camera Failure")
            if functional.get("camera_rear_fail", False): reasons.append("Rear Camera Failure")
            if functional.get("audio_speaker_fail", False): reasons.append("Speaker Failure")
            if functional.get("audio_mic_fail", False): reasons.append("Microphone Failure")
            if functional.get("conn_wifi_fail", False): reasons.append("Wi-Fi Connection Failure")
            return "D", reasons

        # Grade C (Minor failures)
        if (functional.get("display_burn", False) or 
            functional.get("display_dead_pixel", False) or 
            functional.get("button_volume", False) or 
            functional.get("button_lock", False) or 
            functional.get("button_silent", False) or 
            functional.get("button_home", False) or 
            functional.get("camera_autofocus_fail", False) or 
            functional.get("audio_receiver_fail", False) or 
            functional.get("conn_nfc_fail", False) or 
            functional.get("conn_wireless_charge_fail", False)):
            
            if functional.get("display_burn", False): reasons.append("Screen Burn-in")
            if functional.get("display_dead_pixel", False): reasons.append("Dead Pixels")
            if functional.get("button_volume", False): reasons.append("Volume Key Failure")
            if functional.get("button_lock", False): reasons.append("Power/Lock Button Failure")
            if functional.get("button_silent", False): reasons.append("Silent Switch Failure")
            if functional.get("button_home", False): reasons.append("Home Button Failure")
            if functional.get("camera_autofocus_fail", False): reasons.append("Camera Auto Focus Failure")
            if functional.get("audio_receiver_fail", False): reasons.append("Earpiece Receiver Failure")
            if functional.get("conn_nfc_fail", False): reasons.append("NFC Failure")
            if functional.get("conn_wireless_charge_fail", False): reasons.append("Wireless Charging Failure")
            return "C", reasons

        # Grade B (Minor Sensor failures)
        if (functional.get("sensor_gyro", False) or 
            functional.get("sensor_light", False) or 
            functional.get("sensor_proximity", False) or 
            functional.get("sensor_haptics", False)):
            
            if functional.get("sensor_gyro", False): reasons.append("Gyroscope Sensor Failure")
            if functional.get("sensor_light", False): reasons.append("Ambient Light Sensor Failure")
            if functional.get("sensor_proximity", False): reasons.append("Proximity Sensor Failure")
            if functional.get("sensor_haptics", False): reasons.append("Vibration/Haptics Failure")
            return "B", reasons

        return "A", ["All functional tests PASSED"]

    @staticmethod
    def calculate_locks_battery_grade(locks: Dict[str, str], battery: Dict[str, Any]) -> Tuple[str, List[str]]:
        """
        Determines lock & battery grade:
        - Swollen battery or FMIP/MDM Locked -> D
        - Battery Health < 80% -> C
        - SIM Lock or Carrier Lock -> B
        - Unlocked & Health >= 80% -> A
        """
        reasons = []
        
        # Grade D
        if battery.get("swollen", False) or locks.get("fmip_lock") == "LOCKED" or locks.get("mdm_lock") == "LOCKED":
            if battery.get("swollen", False): reasons.append("Swollen Battery Safety Risk")
            if locks.get("fmip_lock") == "LOCKED": reasons.append("Find My iPhone (FMIP) Locked")
            if locks.get("mdm_lock") == "LOCKED": reasons.append("Mobile Device Management (MDM) Locked")
            return "D", reasons
            
        # Grade C
        if battery.get("health", 100) < 80:
            reasons.append(f"Battery Health degraded ({battery.get('health')}% < 80%)")
            return "C", reasons
            
        # Grade B
        if locks.get("sim_lock") == "LOCKED" or locks.get("carrier_lock") == "LOCKED":
            if locks.get("sim_lock") == "LOCKED": reasons.append("SIM Lock Active")
            if locks.get("carrier_lock") == "LOCKED": reasons.append("Carrier Lock Active")
            return "B", reasons

        return "A", ["Locks and Battery Health are OK"]

    @classmethod
    def evaluate_device(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Core grading rule: Consider the lowest grade among Cosmetic, Functional, and Locks/Battery.
        Returns final grade, grading breakdown, reasons, and flags.
        """
        cosmetic_grade, cosmetic_reasons = cls.calculate_cosmetic_grade(payload["cosmetic"])
        functional_grade, functional_reasons = cls.calculate_functional_grade(payload["functional"])
        locks_batt_grade, locks_batt_reasons = cls.calculate_locks_battery_grade(payload["locks"], payload["battery"])

        grades = {"Cosmetic": cosmetic_grade, "Functional": functional_grade, "Locks/Battery": locks_batt_grade}
        
        # Order grades to find the minimum: A=4, B=3, C=2, D=1
        grade_values = {"A": 4, "B": 3, "C": 2, "D": 1}
        min_grade_val = 5
        final_grade = "A"
        downgrade_reasons = []

        for category, grade in grades.items():
            val = grade_values[grade]
            if val < min_grade_val:
                min_grade_val = val
                final_grade = grade

        # Gather reasons for the lowest grade specifically
        if final_grade == cosmetic_grade:
            downgrade_reasons.extend(cosmetic_reasons)
        if final_grade == functional_grade:
            downgrade_reasons.extend(functional_reasons)
        if final_grade == locks_batt_grade:
            downgrade_reasons.extend(locks_batt_reasons)

        # Build clean downgrade statement e.g. "Functional test is C: Power Button Failure"
        category_source = ""
        if final_grade == cosmetic_grade and cosmetic_grade != "A":
            category_source = f"Cosmetic is {cosmetic_grade}"
        elif final_grade == functional_grade and functional_grade != "A":
            category_source = f"Functional is {functional_grade}"
        elif final_grade == locks_batt_grade and locks_batt_grade != "A":
            category_source = f"Locks/Battery is {locks_batt_grade}"
        else:
            category_source = "Perfect grade"

        reason_str = f"{category_source} ({', '.join(downgrade_reasons)})"

        # Check for immediate exceptions
        is_safety_exception = payload["battery"].get("swollen", False)
        is_lock_exception = (payload["locks"].get("fmip_lock") == "LOCKED" or 
                             payload["locks"].get("mdm_lock") == "LOCKED")

        return {
            "final_grade": final_grade,
            "breakdown": grades,
            "reasons": downgrade_reasons,
            "reason_summary": reason_str,
            "is_safety_exception": is_safety_exception,
            "is_lock_exception": is_lock_exception
        }
