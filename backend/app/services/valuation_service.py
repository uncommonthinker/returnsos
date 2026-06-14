from typing import Dict, Any, Tuple

class ValuationService:
    # Default base market values for unblemished (Grade A) models
    BASE_MARKET_VALUES = {
        "APPLE:IPHONE 15 PRO MAX": 950.0,
        "APPLE:IPHONE 15 PRO": 850.0,
        "APPLE:IPHONE 15": 700.0,
        "APPLE:IPHONE 14 PRO MAX": 800.0,
        "APPLE:IPHONE 14 PRO": 700.0,
        "APPLE:IPHONE 14": 550.0,
        "APPLE:IPHONE 13 PRO MAX": 650.0,
        "APPLE:IPHONE 13 PRO": 550.0,
        "APPLE:IPHONE 13": 400.0,
        "APPLE:IPHONE 12 PRO": 400.0,
        "APPLE:IPHONE 12": 280.0,
        "APPLE:IPHONE 11": 180.0,
        "APPLE:IPAD AIR": 350.0,
        "APPLE:IPAD PRO": 600.0,
    }

    # Default grade multipliers for selling as-is
    GRADE_MULTIPLIERS = {
        "A": 1.0,
        "B": 0.85,
        "C": 0.65,
        "D": 0.35
    }

    # Default cost of repairs
    REPAIR_COSTS = {
        "display": 120.0,      # Screen burn, dead pixels, LCD damage, touch
        "battery": 60.0,       # Health < 80% replacement
        "camera": 80.0,        # Front/Rear camera issues or autofocus
        "buttons": 45.0,       # Volume/Silent/Home key replacements
        "ports_wireless": 50.0, # NFC, wireless charging failures
        "sensors": 40.0        # Ambient light, proximity, gyro sensors
    }

    # Default decision parameters
    DECISION_PARAMETERS = {
        "lock_clearance_cost": 10.0,
        "locked_salvage_multiplier": 0.20,
        "cannibalize_multiplier_screen_ok": 0.30,
        "cannibalize_multiplier_screen_damaged": 0.15,
        "recycle_price": 15.0,
        "repair_threshold_ratio": 0.70
    }

    @classmethod
    def get_base_value(cls, model: str, custom_base_values: Dict[str, float] = None) -> float:
        model_upper = model.upper().strip()
        base_vals = custom_base_values if custom_base_values is not None else cls.BASE_MARKET_VALUES
        
        # Sort items by model part length descending to match the most specific pattern first
        sorted_items = []
        for key, val in base_vals.items():
            parts = key.split(":")
            model_part = parts[1].upper().strip() if len(parts) > 1 else parts[0].upper().strip()
            sorted_items.append((model_part, val))
        sorted_items.sort(key=lambda x: len(x[0]), reverse=True)
        
        for model_part, val in sorted_items:
            if model_part in model_upper:
                return float(val)
        return 220.0  # Default base price for unrecognized models

    @classmethod
    def calculate_repair_need_and_cost(cls, payload: Dict[str, Any], grading: Dict[str, Any], custom_repair_costs: Dict[str, float] = None) -> Tuple[float, Dict[str, float]]:
        """
        Computes necessary repair costs based on failures.
        """
        functional = payload["functional"]
        locks = payload["locks"]
        battery = payload["battery"]
        
        repairs_needed = {}
        total_cost = 0.0
        costs = custom_repair_costs if custom_repair_costs is not None else cls.REPAIR_COSTS

        # 1. Screen / Display repairs
        if (functional.get("display_lcd_damage", False) or 
            functional.get("display_touch_fail", False) or 
            functional.get("display_burn", False) or 
            functional.get("display_dead_pixel", False) or
            payload["cosmetic"].get("screen") == "CRACKS"):
            
            cost = float(costs.get("display", 120.0))
            repairs_needed["Display Assembly Replacement"] = cost
            total_cost += cost

        # 2. Battery replacements
        # (Exclude swollen battery since that triggers immediate Recycle exception)
        if battery.get("health", 100) < 80 and not battery.get("swollen", False):
            cost = float(costs.get("battery", 60.0))
            repairs_needed["Battery Cell Replacement"] = cost
            total_cost += cost

        # 3. Camera repairs
        if (functional.get("camera_front_fail", False) or 
            functional.get("camera_rear_fail", False) or 
            functional.get("camera_autofocus_fail", False) or
            payload["cosmetic"].get("camera_lens") == "CRACKS"):
            
            cost = float(costs.get("camera", 80.0))
            repairs_needed["Camera Module Repair"] = cost
            total_cost += cost

        # 4. Buttons repairs
        if (functional.get("button_volume", False) or 
            functional.get("button_lock", False) or 
            functional.get("button_silent", False) or 
            functional.get("button_home", False)):
            
            cost = float(costs.get("buttons", 45.0))
            repairs_needed["Physical Button Cables & Assembly"] = cost
            total_cost += cost

        # 5. Connectivity repairs
        if (functional.get("conn_nfc_fail", False) or 
            functional.get("conn_wireless_charge_fail", False)):
            
            cost = float(costs.get("ports_wireless", 50.0))
            repairs_needed["Charging Port & Connectivity Antennas"] = cost
            total_cost += cost

        # 6. Sensors repairs
        if (functional.get("sensor_gyro", False) or 
            functional.get("sensor_light", False) or 
            functional.get("sensor_proximity", False) or 
            functional.get("sensor_haptics", False)):
            
            cost = float(costs.get("sensors", 40.0))
            repairs_needed["Sensor Array Calibration / Repair"] = cost
            total_cost += cost

        return total_cost, repairs_needed

    @classmethod
    def determine_optimal_recovery(cls, payload: Dict[str, Any], grading: Dict[str, Any],
                                   custom_base_values: Dict[str, float] = None,
                                   custom_repair_costs: Dict[str, float] = None,
                                   custom_multipliers: Dict[str, float] = None,
                                   custom_decision_params: Dict[str, float] = None) -> Dict[str, Any]:
        """
        Compares all disposal paths and returns the one with the highest recovered value.
        """
        model = payload["model"]
        base_val = cls.get_base_value(model, custom_base_values)
        final_grade = grading["final_grade"]
        
        # Calculate repairs
        repair_cost, repairs_list = cls.calculate_repair_need_and_cost(payload, grading, custom_repair_costs)

        # Parse decision parameters
        dp = custom_decision_params if custom_decision_params is not None else cls.DECISION_PARAMETERS
        lock_clearance_cost = float(dp.get("lock_clearance_cost", 10.0))
        locked_salvage_multiplier = float(dp.get("locked_salvage_multiplier", 0.20))
        cannibalize_multiplier_screen_ok = float(dp.get("cannibalize_multiplier_screen_ok", 0.30))
        cannibalize_multiplier_screen_damaged = float(dp.get("cannibalize_multiplier_screen_damaged", 0.15))
        recycle_price = float(dp.get("recycle_price", 15.0))
        repair_threshold_ratio = float(dp.get("repair_threshold_ratio", 0.70))

        # Exception 1: Safety Swollen Battery -> Direct Recycle
        if grading["is_safety_exception"]:
            return {
                "base_market_value": base_val,
                "repair_cost": 0.0,
                "repairs_needed": {},
                "optimal_action": "RECYCLE",
                "estimated_recovery": recycle_price,
                "reasoning": f"Swollen battery safety hazard detected. Mandatory recycling route triggered (yields ${recycle_price:.2f}).",
                "rvp": (recycle_price / base_val) * 100 if base_val > 0 else 0.0,
                "options": {
                    "RESELL": 0.0,
                    "REPAIR": 0.0,
                    "CANNIBALIZE": 0.0,
                    "RECYCLE": recycle_price
                }
            }

        # Calculate Cannibalize Recovery
        screen_ok = payload["cosmetic"].get("screen") != "CRACKS" and not payload["functional"].get("display_lcd_damage", False)
        cannibalize_mult = cannibalize_multiplier_screen_ok if screen_ok else cannibalize_multiplier_screen_damaged
        cannibalize_recovery = base_val * cannibalize_mult

        if grading["is_lock_exception"]:
            # Locked Device Paths:
            # 1. LOCK_CLEARANCE: Invest lock_clearance_cost + repair display/other parts, then resell at full Grade A base value
            lock_clearance_recovery = base_val - lock_clearance_cost - repair_cost
            if repair_cost > (base_val * repair_threshold_ratio):
                lock_clearance_recovery = 0.0

            # 2. RESELL (As-is locked salvage)
            locked_salvage_recovery = base_val * locked_salvage_multiplier

            options = {
                "LOCK_CLEARANCE": lock_clearance_recovery,
                "CANNIBALIZE": cannibalize_recovery,
                "RECYCLE": recycle_price,
                "RESELL": locked_salvage_recovery
            }
        else:
            # Unlocked Device Paths:
            # 1. RESELL (As-Is unlocked)
            multipliers = custom_multipliers if custom_multipliers is not None else cls.GRADE_MULTIPLIERS
            as_is_multiplier = float(multipliers.get(final_grade, 0.5))
            as_is_recovery = base_val * as_is_multiplier

            # 2. REPAIR (Unlock is not needed, repair to Grade A)
            repaired_recovery = base_val - repair_cost
            if repair_cost > (base_val * repair_threshold_ratio):
                repaired_recovery = 0.0

            options = {
                "RESELL": as_is_recovery,
                "REPAIR": repaired_recovery,
                "CANNIBALIZE": cannibalize_recovery,
                "RECYCLE": recycle_price
            }

        # Find maximum recovery
        optimal_action = max(options, key=options.get)
        est_recovery = options[optimal_action]
        rvp = (est_recovery / base_val) * 100 if base_val > 0 else 0.0

        # Detailed breakdown reasons
        reasons_list = []
        if optimal_action == "LOCK_CLEARANCE":
            reasons_list.append(f"Clearing locks (${lock_clearance_cost:.2f} investment) and repairing display/components yields higher return (${lock_clearance_recovery:.2f}) than cannibalizing parts (${cannibalize_recovery:.2f}).")
            if repair_cost > 0:
                reasons_list.append(f"Total repair cost: ${repair_cost:.2f} ({repair_cost/base_val*100:.1f}% of base value).")
        elif optimal_action == "REPAIR":
            reasons_list.append(f"Repairing yields higher return (${repaired_recovery:.2f}) than selling as-is in Grade {final_grade} (${as_is_recovery:.2f}).")
            reasons_list.append(f"Total repair cost: ${repair_cost:.2f} ({repair_cost/base_val*100:.1f}% of base value).")
        elif optimal_action == "RESELL":
            if grading["is_lock_exception"]:
                reasons_list.append(f"Selling device as-is locked salvage yields ${locked_salvage_recovery:.2f} ({(locked_salvage_multiplier * 100):.0f}% of base), which is more profitable than cannibalizing parts or clearing locks.")
            else:
                if repair_cost > 0:
                    reasons_list.append(f"Selling as-is in Grade {final_grade} (${as_is_recovery:.2f}) is more profitable than repairing (${repaired_recovery:.2f}).")
                else:
                    reasons_list.append(f"Device is in Grade {final_grade} with no repairs needed. Direct resell yields 100% of its current grade value (${as_is_recovery:.2f}).")
        elif optimal_action == "CANNIBALIZE":
            if grading["is_lock_exception"]:
                reasons_list.append(f"Device is locked. Cannibalizing parts yields ${cannibalize_recovery:.2f}, which is more profitable than clearing locks and repairing (net ${lock_clearance_recovery:.2f}).")
            else:
                reasons_list.append(f"Device is heavily damaged (Grade {final_grade}), repair costs (${repair_cost:.2f}) exceed resale value. Cannibalizing parts yields ${cannibalize_recovery:.2f}.")
        else: # RECYCLE
            reasons_list.append(f"Device has no salvagable components or severe damage. Recycling yields scrap price of ${recycle_price:.2f}.")

        return {
            "base_market_value": base_val,
            "repair_cost": repair_cost,
            "repairs_needed": repairs_list,
            "optimal_action": optimal_action,
            "estimated_recovery": est_recovery,
            "reasoning": " ".join(reasons_list),
            "rvp": rvp,
            "options": options
        }
