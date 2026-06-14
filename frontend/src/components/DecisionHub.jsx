import React, { useState, useEffect } from 'react';

const BASE_MARKET_VALUES = {
  "iphone 15 pro max": 950.0,
  "iphone 15 pro": 850.0,
  "iphone 15": 700.0,
  "iphone 14 pro max": 800.0,
  "iphone 14 pro": 700.0,
  "iphone 14": 550.0,
  "iphone 13 pro max": 650.0,
  "iphone 13 pro": 550.0,
  "iphone 13": 400.0,
  "iphone 12 pro": 400.0,
  "iphone 12": 280.0,
  "iphone 11": 180.0,
  "ipad air": 350.0,
  "ipad pro": 600.0,
};

const GRADE_MULTIPLIERS = { A: 1.0, B: 0.85, C: 0.65, D: 0.35 };

const REPAIR_COSTS = {
  display: 120.0,
  battery: 60.0,
  camera: 80.0,
  buttons: 45.0,
  ports_wireless: 50.0,
  sensors: 40.0
};

export default function DecisionHub({ triggerRefresh, preSelectedDeviceId, clearPreSelectedDeviceId, showToast }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localRefresh, setLocalRefresh] = useState(0);

  // Dynamic Rules State
  const [baseValues, setBaseValues] = useState(BASE_MARKET_VALUES);
  const [repairCosts, setRepairCosts] = useState(REPAIR_COSTS);
  const [multipliers, setMultipliers] = useState(GRADE_MULTIPLIERS);
  const [decisionParams, setDecisionParams] = useState({
    lock_clearance_cost: 10.0,
    locked_salvage_multiplier: 0.20,
    cannibalize_multiplier_screen_ok: 0.30,
    cannibalize_multiplier_screen_damaged: 0.15,
    recycle_price: 15.0,
    repair_threshold_ratio: 0.70
  });

  // Supervisor Action Override Form State
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideAction, setOverrideAction] = useState("RESELL");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    const fetchDevicesAndSettings = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/devices");
        const data = await res.json();
        setDevices(data);
        if (data.length > 0) {
          let target = null;
          if (preSelectedDeviceId) {
            target = data.find(d => d.id === preSelectedDeviceId);
            if (target) {
              clearPreSelectedDeviceId();
            }
          }
          if (!target) {
            target = selectedDevice ? data.find(d => d.id === selectedDevice.id) : null;
          }
          setSelectedDevice(target || data[0]);
        }

        // Fetch settings and parse rules
        const settingsRes = await fetch("http://localhost:8000/api/settings");
        const settings = await settingsRes.json();
        const baseValsSetting = settings.find(s => s.key === "base_market_values");
        const repairCostsSetting = settings.find(s => s.key === "repair_costs");
        const multipliersSetting = settings.find(s => s.key === "grade_multipliers");
        const decisionParamsSetting = settings.find(s => s.key === "decision_parameters");

        if (baseValsSetting) setBaseValues(JSON.parse(baseValsSetting.value));
        if (repairCostsSetting) setRepairCosts(JSON.parse(repairCostsSetting.value));
        if (multipliersSetting) setMultipliers(JSON.parse(multipliersSetting.value));
        if (decisionParamsSetting) setDecisionParams(JSON.parse(decisionParamsSetting.value));
      } catch (err) {
        console.error("Failed to load devices/rules:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDevicesAndSettings();
  }, [triggerRefresh, localRefresh]);

  useEffect(() => {
    if (preSelectedDeviceId && devices.length > 0) {
      const match = devices.find(d => d.id === preSelectedDeviceId);
      if (match) {
        setSelectedDevice(match);
        clearPreSelectedDeviceId();
      }
    }
  }, [preSelectedDeviceId, devices, clearPreSelectedDeviceId]);

  const selectDevice = (dev) => {
    setSelectedDevice(dev);
    setShowOverrideForm(false);
    setOverrideNotes("");
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case "RESELL": return "badge-resell";
      case "REPAIR": return "badge-repair";
      case "RECYCLE": return "badge-recycle";
      case "CANNIBALIZE": return "badge-cannibalize";
      case "LOCK_CLEARANCE": return "badge-lock";
      default: return "";
    }
  };

  // Parses detail JSON string safely
  const parseJsonSafe = (str) => {
    try {
      if (!str) return {};
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (err) {
      return {};
    }
  };

  const getBaseValue = (model) => {
    const upperModel = model.toUpperCase().trim();
    const sortedBaseValues = Object.entries(baseValues)
      .map(([key, val]) => {
        const parts = key.split(":");
        const modelPart = parts[1] ? parts[1].toUpperCase().trim() : parts[0].toUpperCase().trim();
        return { modelPart, val };
      })
      .sort((a, b) => b.modelPart.length - a.modelPart.length);

    for (const entry of sortedBaseValues) {
      if (upperModel.includes(entry.modelPart)) return entry.val;
    }
    return 220.0;
  };

  // Computes the Decision Matrix for the selected device
  const calculateDecisionMatrix = (dev) => {
    if (!dev) return [];
    
    const baseVal = getBaseValue(dev.model);
    const finalGrade = dev.decision?.final_grade || "D";
    const cosmetic = parseJsonSafe(dev.cosmetic_details);
    const functional = parseJsonSafe(dev.functional_details);
    const isSwollen = dev.battery_swollen;
    const isLocked = dev.fmip_lock === "LOCKED" || dev.mdm_lock === "LOCKED";

    // 1. Calculate repair costs
    let displayCost = 0;
    if (functional.display_lcd_damage || functional.display_touch_fail || functional.display_burn || functional.display_dead_pixel || cosmetic.screen === "CRACKS") {
      displayCost = repairCosts.display;
    }
    let batteryCost = 0;
    if (dev.battery_health < 80 && !isSwollen) {
      batteryCost = repairCosts.battery;
    }
    let cameraCost = 0;
    if (functional.camera_front_fail || functional.camera_rear_fail || functional.camera_autofocus_fail || cosmetic.camera_lens === "CRACKS") {
      cameraCost = repairCosts.camera;
    }
    let buttonsCost = 0;
    if (functional.button_volume || functional.button_lock || functional.button_silent || functional.button_home) {
      buttonsCost = repairCosts.buttons;
    }
    let portsCost = 0;
    if (functional.conn_nfc_fail || functional.conn_wireless_charge_fail) {
      portsCost = repairCosts.ports_wireless;
    }
    let sensorsCost = 0;
    if (functional.sensor_gyro || functional.sensor_light || functional.sensor_proximity || functional.sensor_haptics) {
      sensorsCost = repairCosts.sensors;
    }

    const totalRepairCost = displayCost + batteryCost + cameraCost + buttonsCost + portsCost + sensorsCost;

    // Check channels
    const channels = [];

    const lockClearanceCost = decisionParams.lock_clearance_cost;
    const lockedSalvageMultiplier = decisionParams.locked_salvage_multiplier;
    const cannibalizeMultiplierScreenOk = decisionParams.cannibalize_multiplier_screen_ok;
    const cannibalizeMultiplierScreenDamaged = decisionParams.cannibalize_multiplier_screen_damaged;
    const recyclePrice = decisionParams.recycle_price;
    const repairThresholdRatio = decisionParams.repair_threshold_ratio;

    // -- RESELL --
    let resellNet = baseVal * multipliers[finalGrade];
    let resellViability = "Viable";
    if (isSwollen) {
      resellNet = 0;
      resellViability = "Blocked - Battery swollen hazard";
    } else if (isLocked) {
      resellNet = baseVal * lockedSalvageMultiplier;
      resellViability = "Viable only as locked salvage (" + (lockedSalvageMultiplier * 100).toFixed(0) + "%)";
    }
    channels.push({
      id: "RESELL",
      name: isLocked ? "Sell As-Is Locked Salvage" : "Sell As-Is (Grade " + finalGrade + ")",
      gross: isLocked ? (baseVal * lockedSalvageMultiplier) : (baseVal * multipliers[finalGrade]),
      cost: 0,
      net: resellNet,
      rvp: baseVal > 0 ? (resellNet / baseVal) * 100 : 0.0,
      viability: resellViability
    });

    // -- REPAIR --
    let repairNet = baseVal - totalRepairCost;
    let repairViability = "Viable";
    if (isSwollen) {
      repairNet = 0;
      repairViability = "Blocked - Battery swollen hazard";
    } else if (isLocked) {
      repairNet = 0;
      repairViability = "Blocked - Activation Lock active (Use Lock Clearance)";
    } else if (totalRepairCost > baseVal * repairThresholdRatio) {
      repairNet = 0;
      repairViability = "Not Viable - Cost exceeds " + (repairThresholdRatio * 100).toFixed(0) + "% limit";
    } else if (totalRepairCost === 0) {
      repairViability = "Not Needed - Flawless device";
    }
    channels.push({
      id: "REPAIR",
      name: "Repair and Resell (Grade A)",
      gross: baseVal,
      cost: totalRepairCost,
      net: repairNet,
      rvp: baseVal > 0 ? (repairNet / baseVal) * 100 : 0.0,
      viability: repairViability
    });

    // -- CANNIBALIZE --
    const screenOk = cosmetic.screen !== "CRACKS" && !functional.display_lcd_damage;
    let cannibalizeNet = screenOk ? baseVal * cannibalizeMultiplierScreenOk : baseVal * cannibalizeMultiplierScreenDamaged;
    let cannibalizeViability = "Viable";
    if (isSwollen) {
      cannibalizeNet = 0;
      cannibalizeViability = "Blocked - Battery swollen hazard";
    }
    channels.push({
      id: "CANNIBALIZE",
      name: "Cannibalize Spare Parts",
      gross: cannibalizeNet,
      cost: 0,
      net: cannibalizeNet,
      rvp: baseVal > 0 ? (cannibalizeNet / baseVal) * 100 : 0.0,
      viability: cannibalizeViability
    });

    // -- RECYCLE --
    channels.push({
      id: "RECYCLE",
      name: "Hazard / Material Recycling",
      gross: recyclePrice,
      cost: 0,
      net: recyclePrice,
      rvp: baseVal > 0 ? (recyclePrice / baseVal) * 100 : 0.0,
      viability: isSwollen ? "Optimal - Mandatory swollen battery safety protocol" : "Viable as scrap"
    });

    // -- LOCK_CLEARANCE --
    if (isLocked) {
      let lockNet = baseVal - lockClearanceCost - totalRepairCost;
      let lockViability = "Viable";
      if (isSwollen) {
        lockNet = 0;
        lockViability = "Blocked - Battery swollen hazard";
      } else if (totalRepairCost > baseVal * repairThresholdRatio) {
        lockNet = 0;
        lockViability = "Not Viable - Repair cost exceeds " + (repairThresholdRatio * 100).toFixed(0) + "% limit";
      }
      channels.push({
        id: "LOCK_CLEARANCE",
        name: "Lock Clearance Queue",
        gross: baseVal,
        cost: lockClearanceCost + totalRepairCost,
        net: lockNet,
        rvp: baseVal > 0 ? (lockNet / baseVal) * 100 : 0.0,
        viability: lockViability
      });
    }

    return {
      channels,
      baseVal,
      totalRepairCost,
      repairsList: {
        "Display Unit Replacement": displayCost,
        "Battery Unit Replacement": batteryCost,
        "Camera Lens/Module repair": cameraCost,
        "Button Key Assemblies": buttonsCost,
        "Connectivity Charging flex": portsCost,
        "Sensors array Calibration": sensorsCost
      }
    };
  };

  const handleActionSubmit = async (action, status, notes) => {
    setSubmittingAction(true);
    try {
      const res = await fetch(`http://localhost:8000/api/devices/${selectedDevice.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, status, notes })
      });
      if (res.ok) {
        setLocalRefresh(prev => prev + 1);
        setShowOverrideForm(false);
        setOverrideNotes("");
        if (showToast) {
          showToast(`Device status successfully updated to ${status} with Action: ${action}`, "success");
        } else {
          alert(`Device status successfully updated to ${status} with Action: ${action}`);
        }
      } else {
        if (showToast) {
          showToast("Failed to update device action.", "error");
        } else {
          alert("Failed to update device action.");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const matrixInfo = selectedDevice ? calculateDecisionMatrix(selectedDevice) : null;
  const cosmetic = selectedDevice ? parseJsonSafe(selectedDevice.cosmetic_details) : {};
  const functional = selectedDevice ? parseJsonSafe(selectedDevice.functional_details) : {};
  const isLocked = selectedDevice ? (selectedDevice.fmip_lock === "LOCKED" || selectedDevice.mdm_lock === "LOCKED") : false;
  const screenOk = cosmetic.screen !== "CRACKS" && !functional.display_lcd_damage;

  const agentLogs = selectedDevice && selectedDevice.decision 
    ? parseJsonSafe(selectedDevice.decision.reasoning_json)
    : [];

  const origGrade = selectedDevice?.decision?.final_grade || "D";
  const origValue = matrixInfo?.channels.find(c => c.id === "RESELL")?.net || 0.0;

  const finalAction = selectedDevice?.decision?.recommended_action || "RECYCLE";
  let postActionGrade = origGrade;
  if (finalAction === "REPAIR" || finalAction === "LOCK_CLEARANCE") {
    postActionGrade = "A";
  } else if (finalAction === "RECYCLE" || finalAction === "CANNIBALIZE") {
    postActionGrade = "D (Scrap/Parts)";
  }

  // Get net value for the chosen finalAction from the matrixInfo channels
  const postActionValue = matrixInfo?.channels.find(c => c.id === finalAction)?.net || 0.0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
      
      {/* Devices Registry (Left Panel) */}
      <div className="glass-panel" style={{ padding: '20px', maxHeight: '850px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-secondary)' }}>Recent Evaluations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {devices.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>No records evaluated yet.</div>
          ) : (
            devices.map(d => {
              const isSelected = selectedDevice && selectedDevice.id === d.id;
              const isFinal = d.status === "COMPLETED";
              return (
                <div 
                  key={d.id} 
                  onClick={() => selectDevice(d)}
                  style={{ 
                    padding: '12px', 
                    background: isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.03)'),
                    borderRadius: '10px',
                    cursor: 'pointer',
                    opacity: isFinal ? 0.75 : 1,
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {isFinal && (
                    <span style={{ position: 'absolute', top: '-6px', left: '-6px', background: 'var(--success)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      FINAL
                    </span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', marginTop: isFinal ? '4px' : '0' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{d.model}</span>
                    <span className={`badge ${getActionBadgeClass(d.decision?.recommended_action)}`}>
                      {d.decision?.recommended_action}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Grade: <b>{d.decision?.final_grade || 'D'}</b></span>
                    <span>Yield: <b style={{ color: 'var(--success)' }}>${d.decision?.estimated_recovery_value?.toFixed(2)}</b></span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Decision Board (Right Panel) */}
      <div className="glass-panel" style={{ padding: '24px', maxHeight: '850px', overflowY: 'auto' }}>
        {selectedDevice ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header section */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>{selectedDevice.model}</h2>
                <span className={`badge ${getActionBadgeClass(selectedDevice.decision?.recommended_action)}`} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  Optimal path: {selectedDevice.decision?.recommended_action}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                IMEI/Serial: {selectedDevice.serial_number} | Intake Date: {new Date(selectedDevice.created_at).toLocaleString()}
              </p>
            </div>

            {/* General Specs / Grades */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Final Grade</span>
                <h4 style={{ fontSize: '1.25rem', marginTop: '4px', color: 'white' }}>{selectedDevice.decision?.final_grade}</h4>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confidence</span>
                <h4 style={{ fontSize: '1.25rem', marginTop: '4px', color: 'var(--primary)' }}>
                  {((selectedDevice.decision?.confidence || 0.9) * 100).toFixed(0)}%
                </h4>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Est. Recovery</span>
                <h4 style={{ fontSize: '1.25rem', marginTop: '4px', color: 'var(--success)' }}>
                  ${selectedDevice.decision?.estimated_recovery_value?.toFixed(2)}
                </h4>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Decision Flow</span>
                <h4 style={{ fontSize: '0.75rem', marginTop: '8px', color: selectedDevice.decision?.is_gemini_processed ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                  {selectedDevice.decision?.is_gemini_processed ? "✨ Live Gemini" : "⚙️ Rules Engine"}
                </h4>
              </div>
            </div>

            {/* --- DECISION MATRIX --- */}
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
                📊 Value Recovery Decision Matrix
              </h3>
              <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                      <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Channel Path</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Est. Gross</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Repairs/Deductions</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Net Yield</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>RVP %</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Viability Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixInfo?.channels.map(chan => {
                      const isOptimal = selectedDevice.decision?.recommended_action === chan.id;
                      const isBlocked = chan.viability.startsWith("Blocked") || chan.viability.startsWith("Not Viable");
                      return (
                        <tr key={chan.id} style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                          background: isOptimal ? 'rgba(16, 185, 129, 0.05)' : 'none',
                          borderLeft: isOptimal ? '3px solid var(--success)' : 'none'
                        }}>
                          <td style={{ padding: '10px 12px', fontWeight: isOptimal ? 'bold' : 'normal' }}>
                            {chan.name} {isOptimal && "⭐"}
                          </td>
                          <td style={{ padding: '10px 12px' }}>${chan.gross.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', color: chan.cost > 0 ? 'var(--danger)' : 'inherit' }}>
                            {chan.cost > 0 ? `-$${chan.cost.toFixed(2)}` : "$0.00"}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 'bold', color: isBlocked ? 'var(--text-muted)' : 'var(--success)' }}>
                            ${chan.net.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px', color: isBlocked ? 'var(--text-muted)' : 'var(--success)' }}>
                            {chan.rvp.toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px 12px', color: isBlocked ? 'var(--danger)' : (isOptimal ? 'var(--success)' : 'var(--text-secondary)') }}>
                            {chan.viability}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* --- CALCULATION FORMULATION STEPS --- */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '10px', fontFamily: 'var(--font-display)' }}>
                📐 Est. Recovery Price Formulation Steps
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div>
                  1. <b>Base Market Price</b>: Grade A value for <i>{selectedDevice.model}</i> is <b>${matrixInfo?.baseVal?.toFixed(2)}</b>.
                </div>
                <div>
                  2. <b>Diagnostic Grading</b>: Evaluated grade is <b>Grade {selectedDevice.decision?.final_grade}</b>. 
                  (Cosmetics: {selectedDevice.cosmetic_grade}, Functional: {selectedDevice.functional_grade}, Locks: {selectedDevice.fmip_lock === 'LOCKED' || selectedDevice.mdm_lock === 'LOCKED' ? 'LOCKED' : 'CLEAN'}).
                </div>
                <div>
                  3. <b>Sell As-Is Baseline</b>: Base Value (${matrixInfo?.baseVal}) × Grade Multiplier ({multipliers[selectedDevice.decision?.final_grade || 'D'] * 100}%) = <b>${(matrixInfo?.baseVal * multipliers[selectedDevice.decision?.final_grade || 'D']).toFixed(2)}</b>.
                </div>
                
                {matrixInfo?.totalRepairCost > 0 && (
                  <div style={{ paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                    • <b>Repair Deductions breakdown</b>:
                    {Object.entries(matrixInfo.repairsList).filter(([_, cost]) => cost > 0).map(([part, cost]) => (
                      <div key={part} style={{ color: 'var(--danger)' }}>- {part}: ${cost.toFixed(2)}</div>
                    ))}
                    • <b>Total Hardware Repair Overhead</b>: <b>${matrixInfo.totalRepairCost.toFixed(2)}</b>.
                  </div>
                )}
                
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', color: 'white', fontWeight: 'bold' }}>
                  {selectedDevice.decision?.recommended_action === "REPAIR" && (
                    <>4. Net Formula: Base Value (${matrixInfo?.baseVal?.toFixed(2)}) - Total Repairs (${matrixInfo?.totalRepairCost?.toFixed(2)}) = Net Recovery price of ${selectedDevice.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((selectedDevice.decision?.estimated_recovery_value / matrixInfo?.baseVal) * 100).toFixed(1)}%).</>
                  )}
                  {selectedDevice.decision?.recommended_action === "RESELL" && (
                    isLocked ? (
                      <>4. Net Formula: Device is locked. Sell As-Is Locked Salvage: Base Value (${matrixInfo?.baseVal?.toFixed(2)}) × Locked Salvage Multiplier ({decisionParams.locked_salvage_multiplier * 100}%) = Net Recovery price of ${selectedDevice.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((selectedDevice.decision?.estimated_recovery_value / matrixInfo?.baseVal) * 100).toFixed(1)}%).</>
                    ) : (
                      <>4. Net Formula: Base Value (${matrixInfo?.baseVal?.toFixed(2)}) × As-Is Multiplier ({multipliers[selectedDevice.decision?.final_grade || 'D']*100}%) = Net Recovery price of ${selectedDevice.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((selectedDevice.decision?.estimated_recovery_value / matrixInfo?.baseVal) * 100).toFixed(1)}%).</>
                    )
                  )}
                  {selectedDevice.decision?.recommended_action === "RECYCLE" && (
                    <>4. Net Formula: Quarantined safety hazard or locked recycling. Scrap material recovery price = ${decisionParams.recycle_price?.toFixed(2)}.</>
                  )}
                  {selectedDevice.decision?.recommended_action === "LOCK_CLEARANCE" && (
                    <>4. Net Formula: Activation locks active. Base Value (${matrixInfo?.baseVal?.toFixed(2)}) - Lock Clearance Cost (${decisionParams.lock_clearance_cost?.toFixed(2)}) - Total Repairs (${matrixInfo?.totalRepairCost?.toFixed(2)}) = Net Recovery price of ${selectedDevice.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((selectedDevice.decision?.estimated_recovery_value / matrixInfo?.baseVal) * 100).toFixed(1)}%).</>
                  )}
                  {selectedDevice.decision?.recommended_action === "CANNIBALIZE" && (
                    <>4. Net Formula: Cannibalize parts. Base Value (${matrixInfo?.baseVal?.toFixed(2)}) × Cannibalize Multiplier ({((screenOk ? decisionParams.cannibalize_multiplier_screen_ok : decisionParams.cannibalize_multiplier_screen_damaged) * 100).toFixed(0)}%) = Net Recovery price of ${selectedDevice.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((selectedDevice.decision?.estimated_recovery_value / matrixInfo?.baseVal) * 100).toFixed(1)}%).</>
                  )}
                </div>
              </div>
            </div>

            {/* --- SUPERVISOR ACTIONS PANEL (Accept/Reject/Override) --- */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
              {selectedDevice.status === "COMPLETED" ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '0.85rem' }}>✓ DISPOSITION FINALIZED</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    This recommendation has been finalized and processed into the warehouse system inventory queue.
                  </p>
                  
                  {/* Grade and Value Comparison Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px', marginBottom: '8px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Original Intake State</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--text-primary)' }}>
                        Grade {origGrade}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        As-Is Value: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>${origValue.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div style={{ background: 'rgba(16, 185, 129, 0.04)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--success)', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Post-Action State</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--success)' }}>
                        Grade {postActionGrade}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Final Recovery: <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>${postActionValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {agentLogs.find(l => l.agent_name === "Supervisor Audit") && (
                    <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                      "{agentLogs.find(l => l.agent_name === "Supervisor Audit").message}"
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Supervisor Decision Approval Actions</h4>
                  
                  {!showOverrideForm ? (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 1, background: 'var(--success)' }} 
                        disabled={submittingAction}
                        onClick={() => handleActionSubmit(selectedDevice.decision.recommended_action, "COMPLETED", "Approved AI Recommendation")}
                      >
                        Accept Recommendation
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1 }} 
                        disabled={submittingAction}
                        onClick={() => {
                          setOverrideAction(selectedDevice.decision.recommended_action);
                          setShowOverrideForm(true);
                        }}
                      >
                        Reject & Override Action
                      </button>
                    </div>
                  ) : (
                    <div className="glass-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                      <h5 style={{ fontSize: '0.8rem', marginBottom: '12px', color: 'var(--warning)' }}>Manual Override Settings</h5>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Override Path</label>
                          <select 
                            value={overrideAction} 
                            onChange={(e) => setOverrideAction(e.target.value)}
                            style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem' }}
                          >
                            <option value="RESELL">RESELL</option>
                            <option value="REPAIR">REPAIR</option>
                            <option value="CANNIBALIZE">CANNIBALIZE</option>
                            <option value="RECYCLE">RECYCLE</option>
                            <option value="LOCK_CLEARANCE">LOCK_CLEARANCE</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Override Rationale / Notes</label>
                          <input 
                            type="text" 
                            placeholder="State supervisor rationale..." 
                            value={overrideNotes} 
                            onChange={(e) => setOverrideNotes(e.target.value)}
                            style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem' }} 
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={() => setShowOverrideForm(false)}>
                          Cancel
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--warning)' }} 
                          disabled={submittingAction}
                          onClick={() => handleActionSubmit(overrideAction, "COMPLETED", overrideNotes || "Manual override without notes")}
                        >
                          Confirm Override
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Multi-Agent Discussion Transcript */}
            <div>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', tracking: '0.05em' }}>
                🤖 AI Multi-Agent Discussion Logs
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {agentLogs.filter(l => l.agent_name !== "Supervisor Audit").length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>No AI agent discussions available for this device.</div>
                ) : (
                  agentLogs.filter(l => l.agent_name !== "Supervisor Audit").map((log, idx) => {
                    const colors = {
                      "Condition Assessment Agent": "var(--cyan)",
                      "Recovery Valuation Agent": "var(--warning)",
                      "Disposition Recommendation Agent": "var(--purple)",
                      "Audit Agent": "var(--success)"
                    };
                    const color = colors[log.agent_name] || "white";
                    
                    return (
                      <div key={idx} style={{ 
                        background: 'rgba(255,255,255,0.015)', borderLeft: `3px solid ${color}`, 
                        padding: '10px 14px', borderRadius: '4px 8px 8px 4px', border: '1px solid rgba(255,255,255,0.02)',
                        borderLeftWidth: '3px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: color, fontSize: '0.8rem' }}>{log.agent_name}</span>
                          <span className="badge" style={{ 
                            fontSize: '0.6rem', 
                            background: log.status === "FAILED" ? 'rgba(239, 68, 68, 0.15)' : (log.status === "WARNING" ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                            color: log.status === "FAILED" ? 'var(--danger)' : (log.status === "WARNING" ? 'var(--warning)' : 'var(--success)')
                          }}>
                            {log.status}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {log.message.split(' | ').map((line, lIdx) => (
                            <div key={lIdx} style={{ marginBottom: '3px' }}>• {line}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
            Select a device from the left registry to analyze decision intelligence logs.
          </div>
        )}
      </div>

    </div>
  );
}
