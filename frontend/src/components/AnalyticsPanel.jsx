import React, { useState, useEffect, useRef } from 'react';

const parseJsonSafe = (str) => {
  try {
    return JSON.parse(str) || {};
  } catch (err) {
    return {};
  }
};

export default function AnalyticsPanel({ triggerRefresh, onTakeAction }) {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [baseValues, setBaseValues] = useState({});
  const [repairCosts, setRepairCosts] = useState({
    display: 120.0,
    battery: 60.0,
    camera: 80.0,
    buttons: 45.0,
    ports_wireless: 50.0,
    sensors: 40.0
  });
  const [multipliers, setMultipliers] = useState({
    A: 1.0,
    B: 0.85,
    C: 0.65,
    D: 0.35
  });
  const [decisionParams, setDecisionParams] = useState({
    lock_clearance_cost: 10.0,
    locked_salvage_multiplier: 0.20,
    cannibalize_multiplier_screen_ok: 0.30,
    cannibalize_multiplier_screen_damaged: 0.15,
    recycle_price: 15.0,
    repair_threshold_ratio: 0.70
  });

  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState(null);

  const deepDiveRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, devicesRes, settingsRes] = await Promise.all([
          fetch("http://localhost:8000/api/analytics"),
          fetch("http://localhost:8000/api/devices"),
          fetch("http://localhost:8000/api/settings")
        ]);
        const analytics = await analyticsRes.json();
        const deviceList = await devicesRes.json();
        const settings = await settingsRes.json();

        setAnalyticsData(analytics);
        setDevices(deviceList);

        const baseValsSetting = settings.find(s => s.key === "base_market_values");
        const repairCostsSetting = settings.find(s => s.key === "repair_costs");
        const multipliersSetting = settings.find(s => s.key === "grade_multipliers");
        const decisionParamsSetting = settings.find(s => s.key === "decision_parameters");

        if (baseValsSetting) setBaseValues(JSON.parse(baseValsSetting.value));
        if (repairCostsSetting) setRepairCosts(JSON.parse(repairCostsSetting.value));
        if (multipliersSetting) setMultipliers(JSON.parse(multipliersSetting.value));
        if (decisionParamsSetting) setDecisionParams(JSON.parse(decisionParamsSetting.value));
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [triggerRefresh]);

  const handleCategorySelect = (type, value) => {
    if (selectedCategory && selectedCategory.type === type && selectedCategory.value === value) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory({ type, value });
      setTimeout(() => {
        if (deepDiveRef.current) {
          deepDiveRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const getApprovalStatus = (d) => {
    if (d.status !== "COMPLETED") return "Pending";
    
    const auditLogs = d.decision?.audit_logs || [];
    const supervisorLog = auditLogs.find(l => l.agent_name === "Supervisor Audit");
    if (supervisorLog) {
      if (supervisorLog.message.includes("Approved AI Recommendation")) {
        return "Approved";
      }
      return "Overridden";
    }
    return "Approved"; // Fallback if completed but log omitted
  };

  const calculateDeviceMatrix = (dev) => {
    if (!dev) return null;
    const finalGrade = dev.decision?.final_grade || "D";
    let baseVal = 220.0;
    const devModelUpper = dev.model.toUpperCase().trim();
    const sortedBaseValues = Object.entries(baseValues)
      .map(([key, val]) => {
        const parts = key.split(":");
        const modelPart = parts[1] ? parts[1].toUpperCase().trim() : parts[0].toUpperCase().trim();
        return { modelPart, val };
      })
      .sort((a, b) => b.modelPart.length - a.modelPart.length);

    for (const entry of sortedBaseValues) {
      if (devModelUpper.includes(entry.modelPart)) {
        baseVal = entry.val;
        break;
      }
    }

    const cosmetic = parseJsonSafe(dev.cosmetic_details);
    const functional = parseJsonSafe(dev.functional_details);
    const isSwollen = dev.battery_swollen;
    const isLocked = dev.fmip_lock === "LOCKED" || dev.mdm_lock === "LOCKED";

    // Calculate repairs
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

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Loading Analytics Engine...</div>;
  }

  if (!analyticsData || analyticsData.total_processed === 0) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>No diagnostic records available to analyze. Submit devices to populate dashboard.</div>;
  }

  // Calculate Brand Performance Breakdown
  const getBrandBreakdown = () => {
    const breakdown = {};
    devices.forEach(d => {
      const brand = d.brand || "Other";
      if (!breakdown[brand]) {
        breakdown[brand] = { count: 0, totalValue: 0, totalBase: 0 };
      }
      breakdown[brand].count += 1;
      if (d.decision) {
        breakdown[brand].totalValue += d.decision.estimated_recovery_value;
        const devModelUpper = d.model.toUpperCase().trim();
        let baseVal = 220.0;
        const sortedBaseValues = Object.entries(baseValues)
          .map(([key, val]) => {
            const parts = key.split(":");
            const modelPart = parts[1] ? parts[1].toUpperCase().trim() : parts[0].toUpperCase().trim();
            return { modelPart, val };
          })
          .sort((a, b) => b.modelPart.length - a.modelPart.length);

        for (const entry of sortedBaseValues) {
          if (devModelUpper.includes(entry.modelPart)) {
            baseVal = entry.val;
            break;
          }
        }
        breakdown[brand].totalBase += baseVal;
      }
    });
    return Object.entries(breakdown).map(([name, stats]) => ({
      name,
      count: stats.count,
      totalValue: stats.totalValue,
      avgRvp: stats.totalBase > 0 ? (stats.totalValue / stats.totalBase) * 100 : 0.0
    })).sort((a, b) => b.totalValue - a.totalValue);
  };

  const brandBreakdown = getBrandBreakdown();
  const totalRecoveryDollars = devices.reduce((sum, d) => sum + (d.decision?.estimated_recovery_value || 0), 0);

  // Filter devices for Category Deep Dive
  const getFilteredDevices = () => {
    if (!selectedCategory) return [];
    const { type, value } = selectedCategory;

    return devices.filter(d => {
      // Real-time search term filter
      const matchesSearch = 
        d.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.brand.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (type === "disposition") {
        return d.decision?.recommended_action === value;
      } else if (type === "grade") {
        return d.decision?.final_grade === value;
      } else if (type === "brand") {
        return d.brand === value;
      } else if (type === "exception") {
        if (value === "safety") {
          return d.battery_swollen === true;
        } else if (value === "locks") {
          return d.fmip_lock === "LOCKED" || d.mdm_lock === "LOCKED";
        }
      }
      return false;
    });
  };

  const filteredDevices = getFilteredDevices();

  // Helper to draw SVG Donut Chart
  const drawDonutChart = () => {
    const breakdown = analyticsData.disposition_breakdown;
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    if (total === 0) return null;

    const colors = {
      RESELL: "var(--success)",
      REPAIR: "var(--warning)",
      RECYCLE: "var(--danger)",
      CANNIBALIZE: "var(--purple)",
      LOCK_CLEARANCE: "var(--cyan)"
    };

    let accumulatedAngle = 0;
    const radius = 50;
    const cx = 80;
    const cy = 80;
    const circumference = 2 * Math.PI * radius;

    return (
      <svg width="300" height="160" style={{ overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="16" />
        {Object.entries(breakdown).map(([key, count]) => {
          const percentage = count / total;
          const strokeLength = percentage * circumference;
          const strokeOffset = circumference - strokeLength + accumulatedAngle;
          accumulatedAngle -= strokeLength;
          const isSelected = selectedCategory?.type === "disposition" && selectedCategory?.value === key;
          
          return (
            <circle 
              key={key} cx={cx} cy={cy} r={radius} fill="none" 
              stroke={colors[key] || "gray"} strokeWidth={isSelected ? "22" : "16"}
              strokeDasharray={`${strokeLength} ${circumference}`}
              strokeDashoffset={strokeOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
              onClick={() => handleCategorySelect("disposition", key)}
              opacity={selectedCategory && !isSelected ? 0.35 : 1}
            />
          );
        })}
        {/* Center Text */}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="bold">
          {total} Total
        </text>
        {/* Legend */}
        <g transform="translate(160, 20)">
          {Object.entries(breakdown).map(([key, count], i) => {
            const isSelected = selectedCategory?.type === "disposition" && selectedCategory?.value === key;
            return (
              <g 
                key={key} 
                transform={`translate(0, ${i * 24})`} 
                style={{ cursor: 'pointer' }} 
                onClick={() => handleCategorySelect("disposition", key)}
                opacity={selectedCategory && !isSelected ? 0.4 : 1}
              >
                <rect width="12" height="12" rx="3" fill={colors[key] || "gray"} stroke={isSelected ? "white" : "none"} strokeWidth="1.5" />
                <text x="20" y="10" fill="var(--text-primary)" fontSize="11" fontWeight={isSelected ? "bold" : "normal"}>
                  {key} ({count})
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  // Helper to draw SVG Bar Chart for grades
  const drawBarChart = () => {
    const breakdown = analyticsData.grade_breakdown;
    const grades = ["A", "B", "C", "D"];
    const maxVal = Math.max(...grades.map(g => breakdown[g] || 0), 1);
    const height = 120;
    const width = 240;
    const barWidth = 32;
    const gap = 20;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '140px' }}>
        {grades.map((grade, i) => {
          const count = breakdown[grade] || 0;
          const barHeight = (count / maxVal) * (height - 30);
          const x = i * (barWidth + gap) + 20;
          const y = height - barHeight - 20;
          const isSelected = selectedCategory?.type === "grade" && selectedCategory?.value === grade;
          
          return (
            <g 
              key={grade} 
              style={{ cursor: 'pointer' }} 
              onClick={() => handleCategorySelect("grade", grade)}
              opacity={selectedCategory && !isSelected ? 0.4 : 1}
            >
              {/* Bar */}
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill="var(--primary)" opacity={isSelected ? 1.0 : (0.8 + (i * 0.05))} />
              {/* Text Count */}
              <text x={x + barWidth/2} y={y - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="bold">
                {count}
              </text>
              {/* Grade Label */}
              <text x={x + barWidth/2} y={height - 4} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontWeight="bold">
                Grade {grade}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Helper to draw SVG Line Chart for daily yields
  const drawLineChart = () => {
    const trend = analyticsData.recovery_trend || [];
    if (trend.length === 0) return null;
    const maxVal = Math.max(...trend.map(d => d.value), 100);
    const height = 120;
    const width = 600;
    
    const points = trend.map((d, i) => {
      const x = (i / (trend.length - 1)) * (width - 60) + 30;
      const y = height - (d.value / maxVal) * (height - 30) - 20;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '140px', overflow: 'visible' }}>
        {/* Glow fill underneath path */}
        <polygon 
          fill="rgba(16, 185, 129, 0.05)" 
          stroke="none"
          points={`30,${height-20} ` + trend.map((d, i) => {
            const x = (i / (trend.length - 1)) * (width - 60) + 30;
            const y = height - (d.value / maxVal) * (height - 30) - 20;
            return `${x},${y}`;
          }).join(' ') + ` ${width-30},${height-20}`}
        />
        <polyline fill="none" stroke="var(--success)" strokeWidth="3" points={points} />
        {trend.map((d, i) => {
          const x = (i / (trend.length - 1)) * (width - 60) + 30;
          const y = height - (d.value / maxVal) * (height - 30) - 20;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="var(--bg-surface-solid)" stroke="var(--success)" strokeWidth="2.5" />
              {/* Tooltip value */}
              <text x={x} y={y - 10} textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="bold">
                ${d.value.toFixed(0)}
              </text>
              {/* Date label */}
              <text x={x} y={height - 2} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Financial Recovery Yield</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '6px', color: 'var(--success)' }}>${totalRecoveryDollars.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Total estimated recovery value of inventory</p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--cyan)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Recovery Value % (RVP)</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '6px', color: 'var(--cyan)' }}>{analyticsData.avg_rvp.toFixed(1)}%</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Warehouse baseline (Industry target: 45%)</p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Devices Evaluated</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '6px', color: 'var(--primary)' }}>{analyticsData.total_processed}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Across all warehouse receipt gates</p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--warning)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Processing Velocity</span>
          <h3 style={{ fontSize: '1.8rem', marginTop: '6px', color: 'var(--warning)' }}>{analyticsData.avg_processing_time_sec}s</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Decisions compiled in real-time</p>
        </div>

      </div>

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '24px' }}>
        
        {/* Donut Chart */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
            🎯 Routing Channels (Click to filter)
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '160px' }}>
            {drawDonutChart()}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
            📊 Grade Breakdown (Click to filter)
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '160px' }}>
            {drawBarChart()}
          </div>
        </div>

        {/* Brand Breakdown */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
            🏷️ Brands Performance (Click to filter)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '160px' }}>
            {brandBreakdown.map(b => {
              const isSelected = selectedCategory?.type === "brand" && selectedCategory?.value === b.name;
              return (
                <div 
                  key={b.name} 
                  onClick={() => handleCategorySelect("brand", b.name)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.015)', 
                    padding: '8px 12px', borderRadius: '8px', 
                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.03)'),
                    cursor: 'pointer', transition: 'all 0.2s',
                    opacity: selectedCategory && !isSelected ? 0.4 : 1
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{b.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({b.count})</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold' }}>${b.totalValue.toFixed(2)}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Avg RVP: {b.avgRvp.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Daily yield trend chart & Exception Registry Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Trend line */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Daily Recovered Revenue Yield ($)</h3>
          <div style={{ height: '150px' }}>
            {drawLineChart()}
          </div>
        </div>

        {/* Quarantine Alarm Cards */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--danger)', fontFamily: 'var(--font-display)' }}>
            ⚠️ Exceptions Quarantine (Click to filter)
          </h3>
          <div 
            onClick={() => handleCategorySelect("exception", "safety")}
            style={{ 
              background: selectedCategory?.type === 'exception' && selectedCategory?.value === 'safety' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.05)', 
              padding: '14px', borderRadius: '8px', 
              border: '1px solid ' + (selectedCategory?.type === 'exception' && selectedCategory?.value === 'safety' ? 'var(--danger)' : 'rgba(239, 68, 68, 0.1)'), 
              cursor: 'pointer', transition: 'all 0.2s',
              opacity: selectedCategory && (selectedCategory?.type !== 'exception' || selectedCategory?.value !== 'safety') ? 0.4 : 1
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Swollen Batteries (Safety)</span>
            <h4 style={{ fontSize: '1.5rem', color: 'var(--danger)', marginTop: '4px' }}>{analyticsData.exception_breakdown?.safety || 0}</h4>
          </div>
          <div 
            onClick={() => handleCategorySelect("exception", "locks")}
            style={{ 
              background: selectedCategory?.type === 'exception' && selectedCategory?.value === 'locks' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.05)', 
              padding: '14px', borderRadius: '8px', 
              border: '1px solid ' + (selectedCategory?.type === 'exception' && selectedCategory?.value === 'locks' ? 'var(--purple)' : 'rgba(139, 92, 246, 0.1)'), 
              cursor: 'pointer', transition: 'all 0.2s',
              opacity: selectedCategory && (selectedCategory?.type !== 'exception' || selectedCategory?.value !== 'locks') ? 0.4 : 1
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Activation MDM/FMIP Locks</span>
            <h4 style={{ fontSize: '1.5rem', color: 'var(--purple)', marginTop: '4px' }}>{analyticsData.exception_breakdown?.locks || 0}</h4>
          </div>
        </div>

      </div>

      {/* Interactive Category Deep Dive Section */}
      {selectedCategory && (
        <div ref={deepDiveRef} className="glass-panel animate-dive" style={{ padding: '24px', border: '1px solid var(--primary)', animation: 'pulseGlow 2.5s infinite ease-in-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔍 Deep Dive Category Analysis: <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{selectedCategory.type}: {selectedCategory.value}</span>
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Detailed list representing filtered device receipt pipelines
              </span>
            </div>
            
            <button 
              onClick={() => setSelectedCategory(null)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              Clear Category Filter ×
            </button>
          </div>

          {/* Quick Metrics for the Filtered List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Filtered Count</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '2px' }}>{filteredDevices.length} devices</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total Est. Recovery</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--success)' }}>
                ${filteredDevices.reduce((sum, d) => sum + (d.decision?.estimated_recovery_value || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Avg. Battery Health</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--warning)' }}>
                {(filteredDevices.reduce((sum, d) => sum + d.battery_health, 0) / (filteredDevices.length || 1)).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Search bar inside deep dive */}
          <div style={{ marginBottom: '16px' }}>
            <input 
              type="text" 
              placeholder="Search filtered list by Serial, Model, or Brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '10px 16px', borderRadius: '8px', 
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', 
                color: 'var(--text-primary)', fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Devices Table */}
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>IMEI/Serial</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Device Profile</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>Grade</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Recommended Routing</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>Est. Recovery</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>Approval Status</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                      No matching devices found under search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map(d => {
                    const appStatus = getApprovalStatus(d);
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {d.serial_number}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>
                          {d.brand} {d.model}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold' }}>
                          <span style={{ color: d.decision?.final_grade === 'A' ? 'var(--success)' : (d.decision?.final_grade === 'B' ? 'var(--cyan)' : 'var(--warning)') }}>
                            {d.decision?.final_grade || 'D'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${d.decision?.recommended_action === 'RESELL' ? 'badge-resell' : (d.decision?.recommended_action === 'REPAIR' ? 'badge-repair' : (d.decision?.recommended_action === 'RECYCLE' ? 'badge-recycle' : (d.decision?.recommended_action === 'CANNIBALIZE' ? 'badge-cannibalize' : 'badge-lock')))}`}>
                            {d.decision?.recommended_action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                          ${d.decision?.estimated_recovery_value?.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem',
                            background: appStatus === 'Approved' ? 'rgba(16, 185, 129, 0.12)' : (appStatus === 'Overridden' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(245, 158, 11, 0.12)'),
                            color: appStatus === 'Approved' ? 'var(--success)' : (appStatus === 'Overridden' ? 'var(--purple)' : 'var(--warning)')
                          }}>
                            {appStatus === 'Approved' ? 'Approved ✓' : (appStatus === 'Overridden' ? 'Overridden ⚙️' : 'Pending ⏳')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px' }}
                            onClick={() => setSelectedDeviceDetail(d)}
                          >
                            Show Details
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ 
                              padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px',
                              background: appStatus === 'Pending' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                              border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer'
                            }}
                            onClick={() => onTakeAction && onTakeAction(d.id)}
                          >
                            {appStatus === 'Pending' ? 'Take Action' : 'Review'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynamic Popout Details Modal */}
      {selectedDeviceDetail && (() => {
        const dev = selectedDeviceDetail;
        const matrix = calculateDeviceMatrix(dev);
        const cosmetic = parseJsonSafe(dev.cosmetic_details);
        const functional = parseJsonSafe(dev.functional_details);
        const isSwollen = dev.battery_swollen;
        const isLocked = dev.fmip_lock === "LOCKED" || dev.mdm_lock === "LOCKED";
        const screenOk = cosmetic.screen !== "CRACKS" && !functional.display_lcd_damage;
        const logs = dev.decision ? parseJsonSafe(dev.decision.reasoning_json) : [];
        const appStatus = getApprovalStatus(dev);

        return (
          <div 
            style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setSelectedDeviceDetail(null)}
          >
            <div 
              className="glass-panel" 
              style={{ 
                width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto',
                padding: '28px', background: 'var(--bg-surface-solid)', border: '1px solid var(--border-glow)',
                position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px',
                boxShadow: '0 0 24px var(--border-glow)'
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
              {/* Close Icon */}
              <button 
                onClick={() => setSelectedDeviceDetail(null)}
                style={{ 
                  position: 'absolute', top: '16px', right: '20px', 
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: '1.75rem', cursor: 'pointer', outline: 'none'
                }}
              >
                ×
              </button>

              {/* Title Header */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginRight: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0, color: 'var(--text-primary)' }}>
                    {dev.brand} {dev.model}
                  </h2>
                  <span className={`badge ${dev.decision?.recommended_action === 'RESELL' ? 'badge-resell' : (dev.decision?.recommended_action === 'REPAIR' ? 'badge-repair' : (dev.decision?.recommended_action === 'RECYCLE' ? 'badge-recycle' : (dev.decision?.recommended_action === 'CANNIBALIZE' ? 'badge-cannibalize' : 'badge-lock')))}`}>
                    {dev.decision?.recommended_action}
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px', 
                    background: appStatus === 'Approved' ? 'rgba(16, 185, 129, 0.15)' : (appStatus === 'Overridden' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'), 
                    color: appStatus === 'Approved' ? 'var(--success)' : (appStatus === 'Overridden' ? 'var(--purple)' : 'var(--warning)'), 
                    fontWeight: 'bold' 
                  }}>
                    {appStatus === 'Approved' ? 'Approved ✓' : (appStatus === 'Overridden' ? 'Overridden ⚙️' : 'Pending ⏳')}
                  </span>
                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px',
                      background: appStatus === 'Pending' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer',
                      marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                    onClick={() => {
                      setSelectedDeviceDetail(null);
                      onTakeAction && onTakeAction(dev.id);
                    }}
                  >
                    {appStatus === 'Pending' ? 'Take Action →' : 'Review in Hub →'}
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Serial/IMEI: <span style={{ fontFamily: 'monospace' }}>{dev.serial_number}</span> | Date Ingested: {new Date(dev.created_at).toLocaleString()}
                </div>
              </div>

              {/* Grid detail */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Cosmetic Condition</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--text-primary)' }}>Grade {dev.cosmetic_grade}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Functional Condition</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--text-primary)' }}>Grade {dev.functional_grade}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Battery State</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '2px', color: isSwollen ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {dev.battery_health}% {isSwollen ? "(Swollen ⚠️)" : "(Normal)"}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Grade A Base Value</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '2px', color: 'var(--success)' }}>
                    ${matrix?.baseVal?.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Decision Matrix Table */}
              <div>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                  📊 Value Recovery Decision Matrix
                </h3>
                <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                        <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Channel Path</th>
                        <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Est. Gross</th>
                        <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Repairs/Deductions</th>
                        <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Net Yield</th>
                        <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>RVP %</th>
                        <th style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>Viability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix?.channels.map(chan => {
                        const isOptimal = dev.decision?.recommended_action === chan.id;
                        const isBlocked = chan.viability.startsWith("Blocked") || chan.viability.startsWith("Not Viable");
                        return (
                          <tr key={chan.id} style={{ 
                            borderBottom: '1px solid var(--border-color)',
                            background: isOptimal ? 'rgba(16, 185, 129, 0.05)' : 'none',
                            borderLeft: isOptimal ? '3px solid var(--success)' : 'none'
                          }}>
                            <td style={{ padding: '8px 10px', fontWeight: isOptimal ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                              {chan.name} {isOptimal && "⭐"}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>${chan.gross.toFixed(2)}</td>
                            <td style={{ padding: '8px 10px', color: chan.cost > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                              {chan.cost > 0 ? `-$${chan.cost.toFixed(2)}` : "$0.00"}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 'bold', color: isBlocked ? 'var(--text-muted)' : 'var(--success)' }}>
                              ${chan.net.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px', color: isBlocked ? 'var(--text-muted)' : 'var(--success)' }}>
                              {chan.rvp.toFixed(1)}%
                            </td>
                            <td style={{ padding: '8px 10px', color: isBlocked ? 'var(--danger)' : (isOptimal ? 'var(--success)' : 'var(--text-secondary)') }}>
                              {chan.viability}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Est Recovery Price Formulation Steps */}
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                  📐 Recovery Price Formulation Steps
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <div>
                    1. <b>Base Market Price</b>: Grade A value for <i>{dev.model}</i> is <b>${matrix?.baseVal?.toFixed(2)}</b>.
                  </div>
                  <div>
                    2. <b>Diagnostic Grading</b>: Evaluated grade is <b>Grade {dev.decision?.final_grade}</b> (Cosmetic: {dev.cosmetic_grade}, Functional: {dev.functional_grade}, Locks: {isLocked ? 'LOCKED' : 'CLEAN'}).
                  </div>
                  <div>
                    3. <b>Sell As-Is Baseline</b>: Base Value (${matrix?.baseVal}) × Grade Multiplier ({multipliers[dev.decision?.final_grade || 'D'] * 100}%) = <b>${(matrix?.baseVal * multipliers[dev.decision?.final_grade || 'D']).toFixed(2)}</b>.
                  </div>
                  {matrix?.totalRepairCost > 0 && (
                    <div style={{ paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.05)', color: 'var(--danger)' }}>
                      • <b>Total Repair Overhead Deductions</b>: -${matrix.totalRepairCost.toFixed(2)}.
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    {dev.decision?.recommended_action === "REPAIR" && (
                      <>4. Net Formula: Base Value (${matrix?.baseVal?.toFixed(2)}) - Total Repairs (${matrix?.totalRepairCost?.toFixed(2)}) = Net Recovery price of ${dev.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((dev.decision?.estimated_recovery_value / matrix?.baseVal) * 100).toFixed(1)}%).</>
                    )}
                    {dev.decision?.recommended_action === "RESELL" && (
                      isLocked ? (
                        <>4. Net Formula: Device is locked. Sell As-Is Locked Salvage: Base Value (${matrix?.baseVal?.toFixed(2)}) × Locked Salvage Multiplier ({decisionParams.locked_salvage_multiplier * 100}%) = Net Recovery price of ${dev.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((dev.decision?.estimated_recovery_value / matrix?.baseVal) * 100).toFixed(1)}%).</>
                      ) : (
                        <>4. Net Formula: Base Value (${matrix?.baseVal?.toFixed(2)}) × As-Is Multiplier ({multipliers[dev.decision?.final_grade || 'D']*100}%) = Net Recovery price of ${dev.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((dev.decision?.estimated_recovery_value / matrix?.baseVal) * 100).toFixed(1)}%).</>
                      )
                    )}
                    {dev.decision?.recommended_action === "RECYCLE" && (
                      <>4. Net Formula: Quarantined safety hazard or locked recycling. Scrap material recovery price = ${decisionParams.recycle_price?.toFixed(2)}.</>
                    )}
                    {dev.decision?.recommended_action === "LOCK_CLEARANCE" && (
                      <>4. Net Formula: Activation locks active. Base Value (${matrix?.baseVal?.toFixed(2)}) - Lock Clearance Cost (${decisionParams.lock_clearance_cost?.toFixed(2)}) - Total Repairs (${matrix?.totalRepairCost?.toFixed(2)}) = Net Recovery price of ${dev.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((dev.decision?.estimated_recovery_value / matrix?.baseVal) * 100).toFixed(1)}%).</>
                    )}
                    {dev.decision?.recommended_action === "CANNIBALIZE" && (
                      <>4. Net Formula: Cannibalize parts. Base Value (${matrix?.baseVal?.toFixed(2)}) × Cannibalize Multiplier ({((screenOk ? decisionParams.cannibalize_multiplier_screen_ok : decisionParams.cannibalize_multiplier_screen_damaged) * 100).toFixed(0)}%) = Net Recovery price of ${dev.decision?.estimated_recovery_value?.toFixed(2)} (RVP: {((dev.decision?.estimated_recovery_value / matrix?.baseVal) * 100).toFixed(1)}%).</>
                    )}
                  </div>
                </div>
              </div>

              {/* Multi-Agent Cooperative Dialogue logs */}
              {logs.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                    💬 Multi-Agent Cooperative Verification Log
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', maxHeight: '180px', overflowY: 'auto' }}>
                    {logs.map((log, i) => (
                      <div key={i} style={{ borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none', paddingBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.72rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>🤖 {log.agent_name}</span>
                          <span style={{ color: log.status === 'PASSED' || log.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold' }}>
                            {log.status}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                          "{log.message}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
