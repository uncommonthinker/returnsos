import React, { useState, useEffect } from 'react';

export default function SupervisorMobile({ triggerRefresh, showToast, requestConfirm }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, search, history
  const [analytics, setAnalytics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allDevices, setAllDevices] = useState([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  const fetchMobileData = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/analytics");
      const data = await res.json();
      setAnalytics(data);
      
      const devRes = await fetch("http://localhost:8000/api/devices");
      const devData = await devRes.json();
      setAllDevices(devData);
      
      // Extract exception devices to display as active supervisor actions
      const exceptionAlerts = devData.filter(d => 
        d.decision && (d.decision.recommended_action === "LOCK_CLEARANCE" || d.battery_swollen) && d.status !== "COMPLETED"
      ).map(d => ({
        id: d.id,
        serial_number: d.serial_number,
        model: d.model,
        type: d.battery_swollen ? "SAFETY" : "LOCK_CLEARANCE",
        message: d.battery_swollen ? "Hazard: Swollen Battery" : "Action: MDM/FMIP Lock Active",
        resolved: false,
        recommended_action: d.decision.recommended_action
      }));
      setAlerts(exceptionAlerts);

      // Extract history (recently completed)
      const completed = devData.filter(d => d.status === "COMPLETED").slice(-10).reverse();
      setHistory(completed);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMobileData();
  }, [triggerRefresh]);

  const handleAction = async (alertId, actionType) => {
    if (!await requestConfirm(`Are you sure you want to ${actionType.toLowerCase()} this device?`)) return;

    const alertItem = alerts.find(a => a.id === alertId);
    if (!alertItem) return;

    let finalAction = alertItem.recommended_action || "LOCK_CLEARANCE";
    let notes = `Mobile Supervisor: ${actionType}`;

    if (actionType === 'Rejected') {
      finalAction = 'RECYCLE';
      notes = 'Mobile Supervisor Rejected: Routed to Recycle';
    } else if (actionType === 'Quarantined') {
      finalAction = 'RECYCLE';
      notes = 'Mobile Supervisor Confirmed Safety Quarantine';
    }

    try {
      const res = await fetch(`http://localhost:8000/api/devices/${alertId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: finalAction, status: "COMPLETED", notes: notes })
      });

      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
        if (showToast) {
          showToast(`Successfully ${actionType.toLowerCase()} device.`, "success");
        } else {
          alert(`Successfully ${actionType.toLowerCase()} device.`);
        }
        fetchMobileData(); // Refresh history
      } else {
        if (showToast) showToast("Failed to update device action.", "error");
        else alert("Failed to update device action.");
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast("Failed to update device action.", "error");
      else alert("Failed to update device action.");
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    const result = allDevices.find(d => 
      d.serial_number.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    setSearchResult(result || 'NOT_FOUND');
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Loading Mobile App...</div>;
  }

  const drawMobileLineChart = () => {
    if (!analytics || !analytics.recovery_trend || analytics.recovery_trend.length === 0) return null;
    const dataPoints = analytics.recovery_trend;
    const maxVal = Math.max(...dataPoints.map(d => d.value), 100);
    const height = 60;
    const width = 320;
    const points = dataPoints.map((d, i) => {
      const x = (i / (dataPoints.length - 1)) * (width - 20) + 10;
      const y = height - (d.value / maxVal) * (height - 10) - 5;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px`, overflow: 'visible' }}>
        <polyline fill="none" stroke="var(--primary)" strokeWidth="3" points={points} />
        {dataPoints.map((d, i) => {
          const x = (i / (dataPoints.length - 1)) * (width - 20) + 10;
          const y = height - (d.value / maxVal) * (height - 10) - 5;
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="var(--bg-deep)" stroke="var(--primary)" strokeWidth="2" />
          );
        })}
      </svg>
    );
  };

  const renderDashboard = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>RVP Net Yield</span>
          <h4 style={{ fontSize: '1.5rem', color: 'var(--success)', marginTop: '4px' }}>{analytics?.avg_rvp}%</h4>
        </div>
        <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Volume (30d)</span>
          <h4 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginTop: '4px' }}>{analytics?.total_processed}</h4>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '12px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Recovery Trend (Daily $)</span>
        {drawMobileLineChart()}
      </div>

      <h4 style={{ marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Action Required</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.filter(a => !a.resolved).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>All exception alerts resolved.</div>
        ) : (
          alerts.filter(a => !a.resolved).map(a => (
            <div key={a.id} className="glass-panel" style={{ 
              padding: '12px', 
              background: a.type === "SAFETY" ? 'rgba(239, 68, 68, 0.04)' : 'rgba(139, 92, 246, 0.04)',
              borderColor: a.type === "SAFETY" ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ 
                  fontSize: '0.7rem', fontWeight: 'bold', 
                  color: a.type === "SAFETY" ? 'var(--danger)' : 'var(--purple)'
                }}>
                  {a.type === "SAFETY" ? "⚠️ SAFETY ALARM" : "🔒 SECURITY LOCK"}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID: {a.id}</span>
              </div>
              <h5 style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{a.model}</h5>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>IMEI: {a.serial_number}</p>
              
              {a.type === "LOCK_CLEARANCE" ? (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '6px', flex: 1 }} onClick={() => handleAction(a.id, 'Approved')}>
                    Approve Bypass
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '6px', flex: 1, color: 'var(--danger)' }} onClick={() => handleAction(a.id, 'Rejected')}>
                    Reject (Recycle)
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '6px', flex: 1, color: 'var(--danger)' }} onClick={() => handleAction(a.id, 'Quarantined')}>
                    Confirm Quarantine
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );

  const renderSearch = () => (
    <>
      <h4 style={{ marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Device Deep Dive</h4>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder="Enter IMEI or Serial..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
        />
        <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={handleSearch}>
          🔍
        </button>
      </div>

      {searchResult === 'NOT_FOUND' && (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>Device not found.</div>
      )}

      {searchResult && searchResult !== 'NOT_FOUND' && (
        <div className="glass-panel" style={{ padding: '16px' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--primary)' }}>{searchResult.model}</h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>IMEI: {searchResult.serial_number}</p>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>Func: {searchResult.functional_grade}</span>
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>Cosm: {searchResult.cosmetic_grade}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Base Value:</span>
              <span>${searchResult.decision?.financial_matrix?.base_value || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Deductions:</span>
              <span style={{ color: 'var(--danger)' }}>-${searchResult.decision?.financial_matrix?.total_repair_cost || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '8px' }}>
              <span>Est. Recovery:</span>
              <span style={{ color: 'var(--success)' }}>${searchResult.decision?.financial_matrix?.resell?.net_yield?.toFixed(2) || 0}</span>
            </div>
          </div>

          <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>AI Recommended Action</span>
            <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{searchResult.decision?.recommended_action}</span>
          </div>
        </div>
      )}
    </>
  );

  const renderHistory = () => (
    <>
      <h4 style={{ marginBottom: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Recent Decisions</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {history.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>No completed devices.</div>
        ) : (
          history.map(d => (
            <div key={d.id} className="glass-panel" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h5 style={{ fontSize: '0.85rem', margin: '0 0 2px 0' }}>{d.model}</h5>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>IMEI: {d.serial_number}</span>
              </div>
              <span className={`badge badge-${d.decision?.recommended_action?.toLowerCase() || 'default'}`} style={{ fontSize: '0.65rem' }}>
                {d.decision?.recommended_action}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="phone-mockup">
      <div className="phone-screen">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>ReturnsOS Mobile</span>
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>
              {activeTab === 'dashboard' ? 'Supervisor View' : activeTab === 'search' ? 'Deep Dive' : 'Decision History'}
            </h3>
          </div>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
        </div>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'search' && renderSearch()}
        {activeTab === 'history' && renderHistory()}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <div className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="mobile-nav-icon">📊</span>
          <span>Dash</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          <span className="mobile-nav-icon">🔍</span>
          <span>Search</span>
        </div>
        <div className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <span className="mobile-nav-icon">📋</span>
          <span>History</span>
        </div>
      </div>
    </div>
  );
}
