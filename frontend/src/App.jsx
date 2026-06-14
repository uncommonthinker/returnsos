import React, { useState, useEffect } from 'react';
import OperatorConsole from './components/OperatorConsole';
import DecisionHub from './components/DecisionHub';
import AnalyticsPanel from './components/AnalyticsPanel';
import EventStream from './components/EventStream';
import SupervisorMobile from './components/SupervisorMobile';
import RuleConfigurator from './components/RuleConfigurator';

export default function App() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [enableGemini, setEnableGemini] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [theme, setTheme] = useState("light");
  const [toast, setToast] = useState(null); // { message: "", type: "success" | "error" | "info" }
  const [confirmConfig, setConfirmConfig] = useState(null); // { message: "", onConfirm: fn, onCancel: fn }

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  const requestConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        message,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        }
      });
    });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const [preSelectedDeviceId, setPreSelectedDeviceId] = useState(null);

  // Sync theme with body class
  useEffect(() => {
    if (theme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  // Fetch initial system settings (Gemini toggle state) from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/settings");
        const settingsList = await res.json();
        const geminiSetting = settingsList.find(s => s.key === "enable_gemini_flow");
        if (geminiSetting) {
          setEnableGemini(geminiSetting.value === "true");
        }
      } catch (err) {
        console.error("Failed to load system settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleGemini = async () => {
    setSavingSettings(true);
    const newValue = !enableGemini;
    try {
      const res = await fetch("http://localhost:8000/api/settings/enable_gemini_flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue ? "true" : "false" })
      });
      if (res.ok) {
        setEnableGemini(newValue);
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleIntakeSubmitted = () => {
    // Navigate to Kafka Stream to witness real-time event pipeline in action!
    setActiveTab("stream");
  };

  const handleProcessingComplete = () => {
    // When the events finish flowing, trigger all views to fetch fresh data
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="dashboard-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(45deg, var(--primary), var(--success))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ReturnsOS
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decision Intelligence v1.0</span>
          </div>
          <button 
            onClick={handleToggleTheme}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <nav style={{ flex: 1 }}>
          <div className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            📊 Dashboard Analytics
          </div>
          <div className={`nav-link ${activeTab === 'intake' ? 'active' : ''}`} onClick={() => setActiveTab('intake')}>
            📥 Device Intake Wizard
          </div>
          <div className={`nav-link ${activeTab === 'stream' ? 'active' : ''}`} onClick={() => setActiveTab('stream')}>
            ⚡ Live Kafka Broker
          </div>
          <div className={`nav-link ${activeTab === 'decision' ? 'active' : ''}`} onClick={() => setActiveTab('decision')}>
            🧠 Decision Hub
          </div>
          <div className={`nav-link ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
            ⚙️ Rule Configurator
          </div>
          <div className={`nav-link ${activeTab === 'mobile' ? 'active' : ''}`} onClick={() => setActiveTab('mobile')}>
            📱 Supervisor Mobile
          </div>
        </nav>

        {/* Global Settings Panel in Sidebar */}
        <div style={{ 
          marginTop: 'auto', background: 'rgba(255,255,255,0.02)', 
          padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' 
        }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>AI Orchestration Mode</h4>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {enableGemini ? "✨ Gemini Pro/Flash" : "⚙️ Rules Engine Only"}
            </span>
            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={enableGemini} 
                onChange={handleToggleGemini} 
                disabled={savingSettings}
                style={{ opacity: 0, width: 0, height: 0 }} 
              />
              <span style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: enableGemini ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                transition: '0.4s', borderRadius: '34px'
              }}>
                <span style={{
                  position: 'absolute', content: '""', height: '16px', width: '16px',
                  left: enableGemini ? '20px' : '4px', bottom: '3px',
                  backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>
          <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Gemini parses intake variables and enforces grading safety rules.
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-area">
        {activeTab === "analytics" && (
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '8px' }}>Warehouse Yield Operations</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Real-time statistics representing financial recovery (RVP) and diagnostic throughput.</p>
            <AnalyticsPanel 
              triggerRefresh={refreshCounter} 
              onTakeAction={(deviceId) => {
                setPreSelectedDeviceId(deviceId);
                setActiveTab("decision");
              }}
            />
          </div>
        )}

        {activeTab === "intake" && (
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '8px' }}>Asset Ingestion Gate</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Record returned device serial profiles and execute functional components grading check.</p>
            <OperatorConsole onSubmitIntake={handleIntakeSubmitted} />
          </div>
        )}

        {activeTab === "stream" && (
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '8px' }}>Kafka Message Pipeline</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Event-driven logging representing message pub/sub stages inside ReturnsOS.</p>
            <EventStream triggerRefresh={refreshCounter} onProcessingComplete={handleProcessingComplete} />
          </div>
        )}

        {activeTab === "decision" && (
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '8px' }}>Recommendation Audit Hub</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Compile multi-agent AI cooperation outputs, verify grading rules compliance, and review decision logs.</p>
            <DecisionHub 
              triggerRefresh={refreshCounter} 
              preSelectedDeviceId={preSelectedDeviceId}
              clearPreSelectedDeviceId={() => setPreSelectedDeviceId(null)}
              showToast={showToast}
              requestConfirm={requestConfirm}
            />
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '8px' }}>Policy Rules Configurator</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Modify the active decision matrices, base pricing models, repair costs, and grading yield multipliers.</p>
            <RuleConfigurator onSave={() => setRefreshCounter(prev => prev + 1)} showToast={showToast} requestConfirm={requestConfirm} />
          </div>
        )}

        {activeTab === "mobile" && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '8px', textAlign: 'center', width: '100%' }}>Supervisor Executive Mockup</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>Simulates the responsive mobile view loaded by warehouse managers to monitor alarms.</p>
            <SupervisorMobile triggerRefresh={refreshCounter} showToast={showToast} requestConfirm={requestConfirm} />
          </div>
        )}
      </main>

      {/* Rich Notification Toast Overlay */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <span style={{
            fontSize: '1.25rem',
            color: toast.type === 'success' ? 'var(--success)' : (toast.type === 'error' ? 'var(--danger)' : 'var(--primary)')
          }}>
            {toast.type === 'success' ? '✓' : (toast.type === 'error' ? '⚠️' : 'ℹ️')}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', lineHeight: '1.4', flex: 1 }}>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', outline: 'none' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Global Confirm Modal */}
      {confirmConfig && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Confirmation Required</h3>
              <button className="modal-close" onClick={confirmConfig.onCancel}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px 0', color: 'var(--text-secondary)' }}>
              {confirmConfig.message}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={confirmConfig.onCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmConfig.onConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
