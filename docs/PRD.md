# Product & Strategy Specification: ReturnsOS

This document outlines the business case, KPIs, device grading rules, diagnostic categories, and future expansion paths for **ReturnsOS**.

---

## 1. Business Context: The Reverse Logistics Challenge

In electronics retail and insurance, returned devices are typically viewed as liabilities. When a device enters a processing center, operators rely on tribal knowledge to decide its path. This leads to:
* **Margin Erosion**: Valuable parts are recycled; easily repairable items are sold cheap.
* **Velocity Bottlenecks**: Devices pile up waiting for diagnostic reviews.
* **Safety & Security Risks**: Swollen batteries are mishandled, or data is left on locked devices.

**ReturnsOS** acts as a decision intelligence layer, standardizing evaluation rules and using AI to maximize the value recovered from every returned asset.

---

## 2. Key Business Metrics (KPIs)

To measure business outcomes (not just technical features), ReturnsOS tracks:

### Primary KPI: Recovery Value Percentage (RVP)
RVP calculates the proportion of original value recovered after processing and repair costs:
$$\text{RVP} = \frac{\text{Recovered Value} - \text{Repair Cost}}{\text{Original Device Value}} \times 100$$
* *Goal*: Lift average RVP from **42% to 58%+** by routing devices to the highest recovery path.

### Secondary KPIs
1. **Processing Velocity**: Time taken (in minutes) from warehouse receiving to final disposition recommendation.
2. **Manual Intervention Rate**: Percentage of devices requiring manual manager review.
3. **Decision Accuracy**: Percentage of actual sale outcomes matching the predicted recovery value.
4. **Safety Alerts**: Frequency of critical safety (swollen battery) detections.

---

## 3. Grading Engine Rules

ReturnsOS implements a strict **Lowest-Grade Policy** to evaluate cosmetic, functional, and security states.

| Grade | Description | Cosmetic Standards | Functional Standards | Lock & Security Standards |
|---|---|---|---|---|
| **Grade A** | Like New | Flawless glass & frame, zero visible scratches. | All tests pass perfectly. | Fully unlocked, battery health $\ge 80\%$. |
| **Grade B** | Light Wear | Micro-scratches on frame/back, screen is clean. | Minor haptic or sensor failures. | Fully unlocked, battery health $\ge 80\%$. |
| **Grade C** | Moderate Wear | Deep scratches, minor dents, or dust in camera lens. | Non-critical buttons/sensors failed. | Fully unlocked, battery health $< 80\%$. |
| **Grade D** | Heavily Damaged | Cracks anywhere, missing parts, major frame digs. | Screen burn, dead pixels, LCD damage, touch fail. | FMIP/MDM locked, or swollen battery. |

### The Min-Grade Selection Logic
The overall device grade is dictated by the lowest score among the categories:
$$\text{Final Grade} = \min(\text{Cosmetic Grade}, \text{Functional Grade}, \text{Locks/Battery Grade})$$

* *Downgrade Explanation*: If a category causes a lower grade, the system logs the exact reason.
  * **Example 1**: Cosmetic = A, Functional = C, Locks/Battery = A $\rightarrow$ Final Grade = **C**. Reason: "Functional test is C".
  * **Example 2**: Cosmetic = C, Functional = D, Locks/Battery = C $\rightarrow$ Final Grade = **D**. Reason: "Functional test is D".

---

## 4. Diagnostics & Testing Framework

Operators run through a step-by-step diagnostic questionnaire checking the following categories:

### A. Cosmetic Diagnostics
1. **Screen**: Checked for scratches, cracks, digs.
2. **Back Glass**: Checked for scratches, cracks.
3. **Frame/Sides (Left, Right, Top, Bottom)**: Checked for dents, digs, missing buttons, or major scuffs.
4. **Camera Lens**: Checked for cracks, scratches, or dust behind the lens.

### B. Functional Diagnostics
1. **Display Tests**: Screen Burn, Dead Pixels, LCD Damage, Touch Screen responsive.
2. **Sensor Tests**: Accelerometer, Gyroscope, Ambient Light Sensor, Proximity Sensor, Vibration, Haptics.
3. **Physical Buttons**: Volume Up/Down, Lock/Power Button, Silent Switch, Camera/Home Button.
4. **Camera Tests**: Front (Normal, Wide, Ultrawide) and Rear (Normal, Wide, Ultrawide) for picture & video tests, Auto Focus.
5. **Audio Tests**: Speakers, Microphones, Earpiece Receiver, Headphone Jack (if applicable).
6. **Connectivity**: Wi-Fi, Bluetooth, NFC, Wireless Charging.

### C. Lock & Battery Security
1. **Locks**: Find My iPhone (FMIP) Lock, Mobile Device Management (MDM) Lock, SIM Lock, Carrier/Blacklist status.
2. **Battery**: Health Percentage, Swollen battery flag.

---

## 5. Warehouse Exception Flows

ReturnsOS handles two critical failure types:

### Exception 1: Safety Trigger (Swollen Battery)
* **Rule**: If `battery_swollen == true`, the device is graded **D** and immediately routed to **Recycle/Hazmat Disposal**.
* **Reasoning**: Swollen lithium-ion batteries are thermal runaway risks and cannot be repair-tested or shipped normally.

### Exception 2: Security Lock (FMIP / MDM Locked)
* **Rule**: If `fmip_lock == true` or `mdm_lock == true`, the device is routed to the **Lock Clearance Queue**.
* **Reasoning**: Locked devices cannot be erased or resold. The system alerts supervisors to contact the original user/enterprise client to remote-unlock the device. If uncleared within 14 days, the device is designated for parts cannibalization.

---

## 6. Future Platform Roadmap

1. **Reinforcement Learning from Auction Outcomes**: Feed back actual resale values from marketplaces (e.g., eBay, BackMarket) to automatically tune repair threshold rules.
2. **Computer Vision Inspection**: Integrate camera booths to automatically grade cosmetic scratches and detect swollen frame separation.
3. **WMS/ERP Integrations**: Directly pull returns manifests from ERP systems (SAP, Oracle) and push serial statuses to Warehouse Management Systems (WMS).
