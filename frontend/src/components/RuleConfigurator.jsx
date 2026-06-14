import React, { useState, useEffect } from 'react';

export default function RuleConfigurator({ onSave, showToast, requestConfirm }) {
  const [baseValues, setBaseValues] = useState({});
  const [repairCosts, setRepairCosts] = useState({});
  const [multipliers, setMultipliers] = useState({});
  const [decisionParams, setDecisionParams] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");

  // Inline Editing State
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  // Modal Add Model State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalBrand, setModalBrand] = useState("APPLE");
  const [customBrand, setCustomBrand] = useState("");
  const [modalModel, setModalModel] = useState("");
  const [modalValue, setModalValue] = useState("");

  const loadRules = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/settings");
      const settings = await res.json();
      
      const baseValsSetting = settings.find(s => s.key === "base_market_values");
      const repairCostsSetting = settings.find(s => s.key === "repair_costs");
      const multipliersSetting = settings.find(s => s.key === "grade_multipliers");
      const decisionParamsSetting = settings.find(s => s.key === "decision_parameters");

      if (baseValsSetting) {
        const parsed = JSON.parse(baseValsSetting.value);
        // Normalize keys to Brand:Model in FULL UPPER CASE
        const normalized = {};
        for (const [k, v] of Object.entries(parsed)) {
          let uppercaseKey = k.toUpperCase().trim();
          if (!uppercaseKey.includes(":")) {
            // Infer brand from key name for legacy databases
            if (uppercaseKey.includes("IPHONE") || uppercaseKey.includes("IPAD")) {
              uppercaseKey = "APPLE:" + uppercaseKey;
            } else if (uppercaseKey.includes("GALAXY") || uppercaseKey.includes("SAMSUNG")) {
              uppercaseKey = "SAMSUNG:" + uppercaseKey;
            } else if (uppercaseKey.includes("PIXEL")) {
              uppercaseKey = "GOOGLE:" + uppercaseKey;
            } else {
              uppercaseKey = "OTHER:" + uppercaseKey;
            }
          }
          normalized[uppercaseKey] = v;
        }
        setBaseValues(normalized);
      }
      if (repairCostsSetting) setRepairCosts(JSON.parse(repairCostsSetting.value));
      if (multipliersSetting) setMultipliers(JSON.parse(multipliersSetting.value));
      if (decisionParamsSetting) setDecisionParams(JSON.parse(decisionParamsSetting.value));
    } catch (err) {
      console.error("Failed to load rules:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleBaseValueChange = (modelKey, val) => {
    setBaseValues(prev => ({ ...prev, [modelKey]: parseFloat(val) || 0 }));
  };

  const handleRepairCostChange = (componentKey, val) => {
    setRepairCosts(prev => ({ ...prev, [componentKey]: parseFloat(val) || 0 }));
  };

  const handleMultiplierChange = (gradeKey, val) => {
    setMultipliers(prev => ({ ...prev, [gradeKey]: parseFloat(val) || 0 }));
  };

  const handleDecisionParamChange = (paramKey, val) => {
    setDecisionParams(prev => ({ ...prev, [paramKey]: parseFloat(val) || 0 }));
  };

  // Inline table Actions
  const startEditing = (key, val) => {
    setEditingKey(key);
    setEditingValue(val.toString());
  };

  const saveInlineEdit = (key) => {
    const parsedVal = parseFloat(editingValue);
    if (isNaN(parsedVal) || parsedVal <= 0) {
      if (showToast) showToast("Base Value must be a positive number.", "error");
      else alert("Base Value must be a positive number.");
      return;
    }
    const newBaseValues = {
      ...baseValues,
      [key]: parsedVal
    };
    setBaseValues(newBaseValues);
    fetch("http://localhost:8000/api/settings/base_market_values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(newBaseValues) })
    }).catch(err => console.error("Failed to persist inline edit", err));

    setEditingKey(null);
  };

  const cancelInlineEdit = () => {
    setEditingKey(null);
  };

  const handleRemoveModel = async (modelKey) => {
    if (!await requestConfirm(`Are you sure you want to delete ${modelKey.split(':')[1] || modelKey}?`)) {
      return;
    }
    
    const copy = { ...baseValues };
    delete copy[modelKey];
    setBaseValues(copy);

    fetch("http://localhost:8000/api/settings/base_market_values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(copy) })
    }).catch(err => console.error("Failed to persist model removal", err));
  };

  // Add Model from Modal
  const handleModalAddSubmit = (e) => {
    e.preventDefault();
    const brand = (modalBrand === "OTHER" ? customBrand : modalBrand).trim().toUpperCase();
    const model = modalModel.trim().toUpperCase();

    if (!brand) {
      if (showToast) showToast("Brand name must not be empty.", "error");
      else alert("Brand name must not be empty.");
      return;
    }
    if (!model) {
      if (showToast) showToast("Model name must not be empty.", "error");
      else alert("Model name must not be empty.");
      return;
    }
    const parsedVal = parseFloat(modalValue);
    if (isNaN(parsedVal) || parsedVal <= 0) {
      if (showToast) showToast("Base Value must be a positive number.", "error");
      else alert("Base Value must be a positive number.");
      return;
    }

    const finalKey = `${brand}:${model}`;
    if (baseValues[finalKey]) {
      const errMsg = `Model "${finalKey}" already exists in base market values. Modify its value inline instead.`;
      if (showToast) showToast(errMsg, "error");
      else alert(errMsg);
      return;
    }

    const newBaseValues = {
      ...baseValues,
      [finalKey]: parsedVal
    };

    setBaseValues(newBaseValues);

    // Persist immediately to backend
    fetch("http://localhost:8000/api/settings/base_market_values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(newBaseValues) })
    }).catch(err => console.error("Failed to persist new model", err));

    setShowAddModal(false);
    setModalModel("");
    setModalValue("");
    setCustomBrand("");
  };

  // Save all rules to backend
  const handleSaveAllRules = async () => {
    setSaving(true);
    try {
      // 1. Save base market values
      await fetch("http://localhost:8000/api/settings/base_market_values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(baseValues) })
      });

      // 2. Save repair costs
      await fetch("http://localhost:8000/api/settings/repair_costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(repairCosts) })
      });

      // 3. Save multipliers
      await fetch("http://localhost:8000/api/settings/grade_multipliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(multipliers) })
      });

      // 4. Save decision parameters
      await fetch("http://localhost:8000/api/settings/decision_parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: JSON.stringify(decisionParams) })
      });

      if (showToast) showToast("Policy rules and decision matrix parameters successfully saved to database!", "success");
      else alert("Policy rules and decision matrix parameters successfully saved to database!");
      loadRules();
      if (onSave) onSave();
    } catch (err) {
      console.error(err);
      if (showToast) showToast("Failed to save rules.", "error");
      else alert("Failed to save rules.");
    } finally {
      setSaving(false);
    }
  };

  // Helper selectors
  const getUniqueBrands = () => {
    const brands = new Set();
    Object.keys(baseValues).forEach(key => {
      const parts = key.split(":");
      brands.add(parts[1] ? parts[0] : "OTHER");
    });
    return ["ALL", ...Array.from(brands).sort()];
  };

  const getFilteredEntries = () => {
    return Object.entries(baseValues).filter(([key, val]) => {
      const parts = key.split(":");
      const brand = parts[1] ? parts[0] : "OTHER";
      const model = parts[1] ? parts[1] : parts[0];
      
      const matchesSearch = model.toUpperCase().includes(searchTerm.toUpperCase()) || brand.toUpperCase().includes(searchTerm.toUpperCase());
      const matchesBrand = brandFilter === "ALL" || brand.toUpperCase() === brandFilter.toUpperCase();
      return matchesSearch && matchesBrand;
    }).sort((a, b) => a[0].localeCompare(b[0]));
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Loading Policy Configuration...</div>;
  }

  const filteredEntries = getFilteredEntries();
  const uniqueBrands = getUniqueBrands();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Dual Column Layout wrapper */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Base Device Market Values Manager */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', fontFamily: 'var(--font-display)', margin: 0 }}>
                📱 Base Device Market Values ($ Grade A)
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Normalized upper-case brand and model matching.</span>
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ fontSize: '0.75rem', padding: '8px 14px' }}
              onClick={() => setShowAddModal(true)}
            >
              + Add Model
            </button>
          </div>

          {/* Search and Filter Row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <input 
              type="text" 
              placeholder="Search by model or brand..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
            />
            <select 
              value={brandFilter} 
              onChange={(e) => setBrandFilter(e.target.value)}
              style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontSize: '0.8rem', width: '120px' }}
            >
              {uniqueBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Table list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.015)' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>BRAND</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>MODEL NAME</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'right', width: '120px' }}>BASE VALUE ($)</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'center', width: '120px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No matching models found.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(([key, val]) => {
                    const parts = key.split(":");
                    const brand = parts[1] ? parts[0] : "OTHER";
                    const model = parts[1] ? parts[1] : parts[0];
                    const isEditing = editingKey === key;

                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{brand}</td>
                        <td style={{ padding: '10px 12px' }}>{model}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={editingValue} 
                              onChange={(e) => setEditingValue(e.target.value)} 
                              style={{ width: '90px', padding: '4px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--primary)', borderRadius: '4px', color: 'var(--success)', fontWeight: 'bold', textAlign: 'right', fontSize: '0.75rem' }}
                            />
                          ) : (
                            <span style={{ color: 'var(--success)' }}>${val.toFixed(2)}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => saveInlineEdit(key)} style={{ padding: '2px 6px', background: 'var(--success)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>Save</button>
                              <button onClick={cancelInlineEdit} style={{ padding: '2px 6px', background: 'var(--border-color)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.7rem' }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => startEditing(key, val)} style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>Edit</button>
                              <button onClick={() => handleRemoveModel(key)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: Costs & Multipliers and Decisions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Repair Costs */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--warning)', fontFamily: 'var(--font-display)' }}>
              ⚙️ Component Hardware Repair Costs ($)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Deductions applied to restore devices to Grade A baseline specs.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(repairCosts).map(([comp, val]) => (
                <div key={comp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    {comp.replace('_', ' ')} Repair
                  </span>
                  <input 
                    type="number" 
                    value={val} 
                    onChange={(e) => handleRepairCostChange(comp, e.target.value)}
                    style={{ width: '100px', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'right' }} 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Grade Multipliers */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--cyan)', fontFamily: 'var(--font-display)' }}>
              📊 Grade Multipliers
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Payout values based on cosmetic and functional grades.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(multipliers).map(([grade, val]) => (
                <div key={grade} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Grade {grade}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="number" 
                      step="0.05"
                      min="0"
                      max="1.5"
                      value={val} 
                      onChange={(e) => handleMultiplierChange(grade, e.target.value)}
                      style={{ width: '80px', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--cyan)', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'right' }} 
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ({(val * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Value Recovery Parameters */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
              🧠 Value Recovery Decision Parameters
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Global constants and routing thresholds.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Lock Clear Fee ($)
                </label>
                <input 
                  type="number" 
                  value={decisionParams.lock_clearance_cost || 0} 
                  onChange={(e) => handleDecisionParamChange("lock_clearance_cost", e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Locked Payout %
                </label>
                <input 
                  type="number" 
                  step="0.05"
                  value={decisionParams.locked_salvage_multiplier || 0} 
                  onChange={(e) => handleDecisionParamChange("locked_salvage_multiplier", e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Recycle Scrap ($)
                </label>
                <input 
                  type="number" 
                  value={decisionParams.recycle_price || 0} 
                  onChange={(e) => handleDecisionParamChange("recycle_price", e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Repair limit ratio
                </label>
                <input 
                  type="number" 
                  step="0.05"
                  value={decisionParams.repair_threshold_ratio || 0} 
                  onChange={(e) => handleDecisionParamChange("repair_threshold_ratio", e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Parts (Screen OK)
                </label>
                <input 
                  type="number" 
                  step="0.05"
                  value={decisionParams.cannibalize_multiplier_screen_ok || 0} 
                  onChange={(e) => handleDecisionParamChange("cannibalize_multiplier_screen_ok", e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Parts (Screen Bad)
                </label>
                <input 
                  type="number" 
                  step="0.05"
                  value={decisionParams.cannibalize_multiplier_screen_damaged || 0} 
                  onChange={(e) => handleDecisionParamChange("cannibalize_multiplier_screen_damaged", e.target.value)}
                  style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }} 
                />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Save Button Bar */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.01)' }}>
        <button 
          className="btn btn-primary" 
          style={{ padding: '12px 24px', fontSize: '0.9rem' }} 
          onClick={handleSaveAllRules} 
          disabled={saving}
        >
          {saving ? "Saving Configurations..." : "Save Policy Rules & Apply"}
        </button>
      </div>

      {/* MODAL dialog overlay */}
      {showAddModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }} 
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="glass-panel" 
            style={{
              width: '400px', padding: '24px', background: 'var(--bg-surface-solid)',
              border: '1px solid var(--border-glow)', boxShadow: '0 0 24px var(--border-glow)',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'white' }}>
              Add New Valuation Model
            </h3>
            
            <form onSubmit={handleModalAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Brand</label>
                <select 
                  value={modalBrand} 
                  onChange={(e) => setModalBrand(e.target.value)} 
                  style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem' }}
                >
                  <option value="APPLE">APPLE</option>
                  <option value="SAMSUNG">SAMSUNG</option>
                  <option value="GOOGLE">GOOGLE</option>
                  <option value="ONEPLUS">ONEPLUS</option>
                  <option value="OTHER">OTHER (CUSTOM BRAND)</option>
                </select>
              </div>

              {modalBrand === "OTHER" && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Custom Brand Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. MOTOROLA" 
                    value={customBrand} 
                    onChange={(e) => setCustomBrand(e.target.value)} 
                    style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem' }} 
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Model Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. IPHONE 16 PRO" 
                  value={modalModel} 
                  onChange={(e) => setModalModel(e.target.value)} 
                  style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Base Market Value ($)</label>
                <input 
                  type="number" 
                  placeholder="999" 
                  value={modalValue} 
                  onChange={(e) => setModalValue(e.target.value)} 
                  style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontSize: '0.75rem' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }} 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  Create Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
