import React, { useState, useEffect } from 'react';

const TOPICS = [
  { id: "device.received", label: "Device Received", color: "var(--primary)" },
  { id: "testing.completed", label: "Testing Completed", color: "var(--cyan)" },
  { id: "valuation.updated", label: "Valuation Updated", color: "var(--warning)" },
  { id: "decision.pending", label: "Decision Pending", color: "var(--purple)" },
  { id: "decision.audited", label: "Compliance Audited", color: "var(--success)" }
];

export default function EventStream({ triggerRefresh, onProcessingComplete }) {
  const [events, setEvents] = useState([]);
  const [activeTopic, setActiveTopic] = useState(null);
  const [pipelineData, setPipelineData] = useState({});

  useEffect(() => {
    // Connect to FastAPI SSE endpoint
    const eventSource = new EventSource("http://localhost:8000/api/events");

    TOPICS.forEach(topic => {
      eventSource.addEventListener(topic.id, (e) => {
        try {
          const parsed = JSON.parse(e.data);
          
          // Add event to local log list (keep last 30 events)
          setEvents(prev => [parsed, ...prev].slice(0, 30));
          
          // Update active step in pipeline
          setActiveTopic(topic.id);
          
          // Update details displayed in nodes
          setPipelineData(prev => ({
            ...prev,
            [topic.id]: parsed.data
          }));

          // Trigger analytics refresh in parent if last step completed
          if (topic.id === "decision.audited") {
            setTimeout(() => {
              setActiveTopic(null); // Clear highlight
              if (onProcessingComplete) onProcessingComplete();
            }, 2000);
          }
        } catch (err) {
          console.error("Failed to parse event message:", err);
        }
      });
    });

    eventSource.onerror = () => {
      console.warn("SSE connection error. Reconnecting...");
    };

    return () => {
      eventSource.close();
    };
  }, [triggerRefresh]);

  const clearLogs = () => {
    setEvents([]);
    setPipelineData({});
    setActiveTopic(null);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Simulated Kafka Message Broker</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Streams real-time event topics through WebSocket/SSE pipelines.</p>
        </div>
        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={clearLogs}>Clear Stream</button>
      </div>

      {/* Visual Pipeline Nodes */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', 
        border: '1px solid rgba(255,255,255,0.03)', overflowX: 'auto', gap: '16px' 
      }}>
        {TOPICS.map((t, idx) => {
          const isActive = activeTopic === t.id;
          const hasData = !!pipelineData[t.id];
          const nodeData = pipelineData[t.id];

          return (
            <React.Fragment key={t.id}>
              {/* Node Card */}
              <div className="glass-panel" style={{ 
                flex: '1', minWidth: '150px', padding: '16px', 
                border: '1px solid ' + (isActive ? t.color : (hasData ? 'rgba(255,255,255,0.15)' : 'var(--glass-border)')),
                background: isActive ? `rgba(255,255,255,0.03)` : 'rgba(255,255,255,0.01)',
                boxShadow: isActive ? `0 0 16px ${t.color}22` : 'none',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}>
                {isActive && (
                  <div style={{ 
                    position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', 
                    borderRadius: '50%', background: t.color, animation: 'pulseGlow 1.5s infinite' 
                  }} />
                )}
                
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', tracking: '0.05em' }}>Topic: {t.id}</span>
                <h4 style={{ fontSize: '0.9rem', color: isActive ? t.color : 'var(--text-primary)', marginTop: '4px', marginBottom: '8px' }}>{t.label}</h4>
                
                {/* Node details */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {hasData ? (
                    <div>
                      {t.id === "device.received" && (
                        <>
                          <div style={{ fontWeight: '600', color: 'white' }}>{nodeData.model}</div>
                          <div>{nodeData.serial_number}</div>
                        </>
                      )}
                      {t.id === "testing.completed" && (
                        <>
                          <div>Cosm Grade: <span style={{ color: 'white', fontWeight: 'bold' }}>{nodeData.cosmetic_grade}</span></div>
                          <div>Func Grade: <span style={{ color: 'white', fontWeight: 'bold' }}>{nodeData.functional_grade}</span></div>
                        </>
                      )}
                      {t.id === "valuation.updated" && (
                        <>
                          <div>Market: ${nodeData.base_market_value}</div>
                          <div>Rep. Cost: ${nodeData.repair_cost}</div>
                          <div style={{ color: 'var(--success)' }}>RVP: {nodeData.rvp?.toFixed(1)}%</div>
                        </>
                      )}
                      {t.id === "decision.pending" && (
                        <>
                          <div>Proposed: <b style={{ color: 'white' }}>{nodeData.proposed_action}</b></div>
                          <div>Conf: {(nodeData.confidence * 100).toFixed(0)}%</div>
                        </>
                      )}
                      {t.id === "decision.audited" && (
                        <>
                          <div>Action: <b style={{ color: 'var(--success)' }}>{nodeData.final_action}</b></div>
                          <div>Grade: <span style={{ color: 'white', fontWeight: 'bold' }}>{nodeData.final_grade}</span></div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Waiting for event...</span>
                  )}
                </div>
              </div>

              {/* Pipe connection line */}
              {idx < TOPICS.length - 1 && (
                <div style={{ 
                  width: '24px', height: '2px', 
                  background: hasData && !!pipelineData[TOPICS[idx+1].id] ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                  flexShrink: 0
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Terminal logs list */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Live Event Console Logs</h4>
        <div style={{ 
          background: '#04060a', border: '1px solid rgba(255,255,255,0.04)', 
          borderRadius: '8px', padding: '16px', flex: 1, maxHeight: '280px', 
          overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', color: '#38bdf8' 
        }}>
          {events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Listening for active SSE broadcast messages on `http://localhost:8000/api/events`...</div>
          ) : (
            events.map((e, index) => (
              <div key={e.event_id || index} style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '6px' }}>
                <span style={{ color: '#818cf8' }}>[{e.timestamp}]</span>{' '}
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>[{e.topic}]</span>{' '}
                <span style={{ color: '#34d399' }}>event_id: {e.event_id}</span>
                <pre style={{ color: '#e2e8f0', marginTop: '4px', whiteSpace: 'pre-wrap', paddingLeft: '12px' }}>
                  {JSON.stringify(e.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
