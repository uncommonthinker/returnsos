import React, { useState, useEffect } from 'react';

const PRESETS = {
  perfect: {
    brand: "Apple",
    model: "iPhone 14 Pro",
    serial_number: "IMEI" + Math.floor(1000000000 + Math.random() * 9000000000),
    locks: { sim_lock: "UNLOCKED", fmip_lock: "UNLOCKED", mdm_lock: "UNLOCKED", carrier_lock: "UNLOCKED" },
    battery: { health: 92, swollen: false },
    cosmetic: { screen: "NONE", back_glass: "NONE", frame: "NONE", camera_lens: "NONE" },
    functional: {
      display_burn: false, display_dead_pixel: false, display_lcd_damage: false, display_touch_fail: false,
      sensor_gyro: false, sensor_light: false, sensor_proximity: false, sensor_haptics: false,
      button_volume: false, button_lock: false, button_silent: false, button_home: false,
      camera_front_fail: false, camera_rear_fail: false, camera_autofocus_fail: false,
      audio_speaker_fail: false, audio_mic_fail: false, audio_receiver_fail: false,
      conn_wifi_fail: false, conn_nfc_fail: false, conn_wireless_charge_fail: false
    }
  },
  repair_c: {
    brand: "Apple",
    model: "iPhone 13",
    serial_number: "IMEI" + Math.floor(1000000000 + Math.random() * 9000000000),
    locks: { sim_lock: "UNLOCKED", fmip_lock: "UNLOCKED", mdm_lock: "UNLOCKED", carrier_lock: "UNLOCKED" },
    battery: { health: 85, swollen: false },
    cosmetic: { screen: "SCRATCHES", back_glass: "NONE", frame: "DENTS", camera_lens: "NONE" },
    functional: {
      display_burn: true, display_dead_pixel: false, display_lcd_damage: false, display_touch_fail: false,
      sensor_gyro: false, sensor_light: false, sensor_proximity: false, sensor_haptics: false,
      button_volume: false, button_lock: false, button_silent: false, button_home: false,
      camera_front_fail: false, camera_rear_fail: false, camera_autofocus_fail: false,
      audio_speaker_fail: false, audio_mic_fail: false, audio_receiver_fail: false,
      conn_wifi_fail: false, conn_nfc_fail: false, conn_wireless_charge_fail: false
    }
  },
  swollen: {
    brand: "Apple",
    model: "iPhone 12",
    serial_number: "IMEI" + Math.floor(1000000000 + Math.random() * 9000000000),
    locks: { sim_lock: "UNLOCKED", fmip_lock: "UNLOCKED", mdm_lock: "UNLOCKED", carrier_lock: "UNLOCKED" },
    battery: { health: 76, swollen: true },
    cosmetic: { screen: "CRACKS", back_glass: "SCRATCHES", frame: "DENTS", camera_lens: "NONE" },
    functional: {
      display_burn: false, display_dead_pixel: false, display_lcd_damage: true, display_touch_fail: true,
      sensor_gyro: false, sensor_light: false, sensor_proximity: false, sensor_haptics: false,
      button_volume: false, button_lock: false, button_silent: false, button_home: false,
      camera_front_fail: false, camera_rear_fail: false, camera_autofocus_fail: false,
      audio_speaker_fail: false, audio_mic_fail: false, audio_receiver_fail: false,
      conn_wifi_fail: false, conn_nfc_fail: false, conn_wireless_charge_fail: false
    }
  },
  locked: {
    brand: "Apple",
    model: "iPhone 14 Pro Max",
    serial_number: "IMEI" + Math.floor(1000000000 + Math.random() * 9000000000),
    locks: { sim_lock: "UNLOCKED", fmip_lock: "LOCKED", mdm_lock: "UNLOCKED", carrier_lock: "UNLOCKED" },
    battery: { health: 89, swollen: false },
    cosmetic: { screen: "NONE", back_glass: "NONE", frame: "NONE", camera_lens: "NONE" },
    functional: {
      display_burn: false, display_dead_pixel: false, display_lcd_damage: false, display_touch_fail: false,
      sensor_gyro: false, sensor_light: false, sensor_proximity: false, sensor_haptics: false,
      button_volume: false, button_lock: false, button_silent: false, button_home: false,
      camera_front_fail: false, camera_rear_fail: false, camera_autofocus_fail: false,
      audio_speaker_fail: false, audio_mic_fail: false, audio_receiver_fail: false,
      conn_wifi_fail: false, conn_nfc_fail: false, conn_wireless_charge_fail: false
    }
  }
};

export default function OperatorConsole({ onSubmitIntake }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(PRESETS.perfect);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [brandModelMap, setBrandModelMap] = useState({});
  const [availableBrands, setAvailableBrands] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/settings")
      .then(res => res.json())
      .then(data => {
        const baseValuesSetting = data.find(s => s.key === "base_market_values");
        if (baseValuesSetting && baseValuesSetting.value) {
          const parsed = JSON.parse(baseValuesSetting.value);
          const map = {};
          Object.keys(parsed).forEach(k => {
            const parts = k.split(':');
            if (parts.length === 2) {
              const b = parts[0];
              const m = parts[1];
              if (!map[b]) map[b] = [];
              if (!map[b].includes(m)) map[b].push(m);
            }
          });
          setBrandModelMap(map);
          const brands = Object.keys(map).sort();
          setAvailableBrands(brands);
          
          // Set initial fallback values if current values are empty
          setFormData(prev => {
            if (!prev.brand || !brands.includes(prev.brand.toUpperCase())) {
              const defaultBrand = brands[0] || "";
              const defaultModel = map[defaultBrand] ? map[defaultBrand][0] : "";
              return { ...prev, brand: defaultBrand, model: defaultModel };
            }
            return prev;
          });
        }
      })
      .catch(err => console.error("Failed to load settings", err));
  }, []);

  const loadPreset = (presetKey) => {
    // Regenerate unique IMEI for each press
    const updatedPreset = {
      ...PRESETS[presetKey],
      serial_number: "IMEI" + Math.floor(1000000000 + Math.random() * 9000000000)
    };
    setFormData(updatedPreset);
    setErrorMsg("");
  };

  const handleTextChange = (e, category) => {
    const { name, value } = e.target;
    
    if (name === "brand") {
      // If brand changes, auto-select the first model for that brand
      const upperBrand = value.toUpperCase();
      const firstModelForBrand = brandModelMap[upperBrand] ? brandModelMap[upperBrand][0] : "";
      setFormData(prev => ({ ...prev, brand: value, model: firstModelForBrand }));
      return;
    }

    if (category) {
      setFormData(prev => ({
        ...prev,
        [category]: { ...prev[category], [name]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e, category) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [category]: { ...prev[category], [name]: checked }
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.brand || !formData.model || !formData.serial_number) {
        setErrorMsg("Please fill in Brand, Model, and Serial Number.");
        return;
      }
    }
    setErrorMsg("");
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setErrorMsg("");
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 3) {
      handleNext();
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const response = await fetch("http://localhost:8000/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json_stringify_clean(formData)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Intake submission failed.");
      }
      onSubmitIntake();
      setStep(1);
      loadPreset("perfect");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to strip standard prototype properties for json serialization
  const json_stringify_clean = (obj) => {
    return JSON.stringify(obj);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px' }}>Device Diagnostic Intake</h2>
      
      {/* Presets Bar */}
      <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>⚡ Quick Demo Presets (Autofill questionnaire):</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => loadPreset("perfect")}>🟢 Perfect Resell</button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => loadPreset("repair_c")}>🟡 Repair Screen C</button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => loadPreset("swollen")}>🔴 Swollen Batt Hazard</button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => loadPreset("locked")}>🔵 FMIP Security Lock</button>
        </div>
      </div>

      {/* Progress Tracker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 1 }} />
        {[1, 2, 3].map(s => (
          <div key={s} style={{ 
            width: '32px', height: '32px', borderRadius: '50%', 
            background: step === s ? 'var(--primary)' : (step > s ? 'var(--success)' : 'var(--bg-surface-solid)'),
            border: '2px solid ' + (step >= s ? 'var(--primary)' : 'rgba(255,255,255,0.1)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontWeight: 'bold', zIndex: 2, fontSize: '0.9rem'
          }}>
            {s}
          </div>
        ))}
      </div>

      {errorMsg && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div>
        {step === 1 && (
          <div>
            <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Step 1: Device Identity & Security Locks</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Brand</label>
                <select name="brand" value={formData.brand} onChange={handleTextChange} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="" disabled>Select Brand</option>
                  {availableBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value={formData.brand} hidden>{formData.brand}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Model</label>
                <select name="model" value={formData.model} onChange={handleTextChange} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }} disabled={!formData.brand}>
                  <option value="" disabled>Select Model</option>
                  {(brandModelMap[(formData.brand || "").toUpperCase()] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value={formData.model} hidden>{formData.model}</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Serial / IMEI Number</label>
              <input name="serial_number" value={formData.serial_number} onChange={handleTextChange} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }} />
            </div>

            <h4 style={{ marginBottom: '12px', fontSize: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>Security & Locks Check</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Find My iPhone (FMIP)</label>
                <select name="fmip_lock" value={formData.locks.fmip_lock} onChange={(e) => handleTextChange(e, 'locks')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="UNLOCKED">UNLOCKED (Clean)</option>
                  <option value="LOCKED">LOCKED (Exception)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Mobile Device Mgmt (MDM)</label>
                <select name="mdm_lock" value={formData.locks.mdm_lock} onChange={(e) => handleTextChange(e, 'locks')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="UNLOCKED">UNLOCKED (Clean)</option>
                  <option value="LOCKED">LOCKED (Exception)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>SIM Carrier Lock</label>
                <select name="sim_lock" value={formData.locks.sim_lock} onChange={(e) => handleTextChange(e, 'locks')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="UNLOCKED">UNLOCKED</option>
                  <option value="LOCKED">LOCKED (Carrier lock)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Carrier/Blacklist status</label>
                <select name="carrier_lock" value={formData.locks.carrier_lock} onChange={(e) => handleTextChange(e, 'locks')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="UNLOCKED">UNLOCKED (Clean)</option>
                  <option value="LOCKED">LOCKED (Blocked/Blacklisted)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Step 2: Battery & Cosmetic Evaluation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Battery Health: {formData.battery.health}%</label>
                <input type="range" name="health" min="50" max="100" value={formData.battery.health} onChange={(e) => setFormData(prev => ({ ...prev, battery: { ...prev.battery, health: parseInt(e.target.value) } }))} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.1)' }}>
                <input type="checkbox" name="swollen" checked={formData.battery.swollen} onChange={(e) => handleCheckboxChange(e, 'battery')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: '600', cursor: 'pointer' }}>🚨 Swollen Battery</label>
              </div>
            </div>

            <h4 style={{ marginBottom: '12px', fontSize: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>Cosmetic Scuffs, Scratch & Cracks Check</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Screen Condition</label>
                <select name="screen" value={formData.cosmetic.screen} onChange={(e) => handleTextChange(e, 'cosmetic')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="NONE">NONE (Flawless)</option>
                  <option value="SCRATCHES">SCRATCHES (Light Scratches)</option>
                  <option value="DIGS">DIGS (Deep Scratches)</option>
                  <option value="CRACKS">CRACKS (Broken/Cracked)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Back Glass Condition</label>
                <select name="back_glass" value={formData.cosmetic.back_glass} onChange={(e) => handleTextChange(e, 'cosmetic')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="NONE">NONE (Flawless)</option>
                  <option value="SCRATCHES">SCRATCHES (Scratched)</option>
                  <option value="CRACKS">CRACKS (Broken/Cracked)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Frame / Sides (Left/Right/Top/Bottom)</label>
                <select name="frame" value={formData.cosmetic.frame} onChange={(e) => handleTextChange(e, 'cosmetic')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="NONE">NONE (Flawless)</option>
                  <option value="SCRATCHES">SCRATCHES (Scuffs)</option>
                  <option value="DENTS">DENTS (Minor Dents)</option>
                  <option value="DIGS">DIGS (Dents/Digs)</option>
                  <option value="MISSING_PARTS">MISSING PARTS (Buttons/Trays missing)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Camera Lens</label>
                <select name="camera_lens" value={formData.cosmetic.camera_lens} onChange={(e) => handleTextChange(e, 'cosmetic')} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}>
                  <option value="NONE">NONE (Clean)</option>
                  <option value="DUST">DUST (Dust in Camera)</option>
                  <option value="CRACKS">CRACKS (Cracked Lens)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Step 3: Component Functional Tests</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Check any checkbox below to log a <b>FAILURE</b> on that component test.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Display & Sensors */}
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--cyan)', marginBottom: '10px' }}>Display & Sensors</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label><input type="checkbox" name="display_burn" checked={formData.functional.display_burn} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Screen Burn / Ghosting</label>
                  <label><input type="checkbox" name="display_dead_pixel" checked={formData.functional.display_dead_pixel} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Dead Pixels</label>
                  <label><input type="checkbox" name="display_lcd_damage" checked={formData.functional.display_lcd_damage} onChange={(e) => handleCheckboxChange(e, 'functional')} /> LCD Damage / Lines</label>
                  <label><input type="checkbox" name="display_touch_fail" checked={formData.functional.display_touch_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Touch Screen Unresponsive</label>
                  <label><input type="checkbox" name="sensor_gyro" checked={formData.functional.sensor_gyro} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Gyro / Accelerometer Fail</label>
                  <label><input type="checkbox" name="sensor_light" checked={formData.functional.sensor_light} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Proximity/Ambient light Fail</label>
                </div>
              </div>

              {/* Physical Keys & Cameras */}
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--warning)', marginBottom: '10px' }}>Buttons & Cameras</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label><input type="checkbox" name="button_volume" checked={formData.functional.button_volume} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Volume Keys Faulty</label>
                  <label><input type="checkbox" name="button_lock" checked={formData.functional.button_lock} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Lock/Power Button Faulty</label>
                  <label><input type="checkbox" name="button_silent" checked={formData.functional.button_silent} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Silent Toggle Switch Faulty</label>
                  <label><input type="checkbox" name="camera_front_fail" checked={formData.functional.camera_front_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Front Camera Failed</label>
                  <label><input type="checkbox" name="camera_rear_fail" checked={formData.functional.camera_rear_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Rear Camera Failed</label>
                  <label><input type="checkbox" name="camera_autofocus_fail" checked={formData.functional.camera_autofocus_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Camera Auto Focus Failed</label>
                </div>
              </div>

              {/* Audio & Connectivity */}
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', gridColumn: 'span 2' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '10px' }}>Audio & Connectivity</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label><input type="checkbox" name="audio_speaker_fail" checked={formData.functional.audio_speaker_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Speakers Failed (Muffled)</label>
                  <label><input type="checkbox" name="audio_mic_fail" checked={formData.functional.audio_mic_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Microphone Failed</label>
                  <label><input type="checkbox" name="audio_receiver_fail" checked={formData.functional.audio_receiver_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Earpiece Receiver Failed</label>
                  <label><input type="checkbox" name="conn_wifi_fail" checked={formData.functional.conn_wifi_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Wi-Fi / Bluetooth Failed</label>
                  <label><input type="checkbox" name="conn_nfc_fail" checked={formData.functional.conn_nfc_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> NFC Failure</label>
                  <label><input type="checkbox" name="conn_wireless_charge_fail" checked={formData.functional.conn_wireless_charge_fail} onChange={(e) => handleCheckboxChange(e, 'functional')} /> Wireless Charging Failed</label>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Buttons Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={handlePrev}>Back</button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={handleNext}>Next Step</button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Processing Decision..." : "Submit to Decision Engine"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
