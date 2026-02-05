import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity } from 'lucide-react';

export function LogViewer() {
    const [logs, setLogs] = useState([]);
    const bottomRef = useRef(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/logs');
            const data = await res.json();
            setLogs(data);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 1000); // Keep auto-refresh every 1s
        return () => clearInterval(interval);
    }, []);

    // Format timestamp to simple HH:mm:ss
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <aside className="glass-panel log-sidebar">
            <div className="log-header">
                <div className="log-title">
                    <Terminal size={14} color="#8b5cf6" />
                    <span>LIVE LOGS</span>
                </div>
                {/* Refresh button removed per request */}
            </div>

            <div className="log-content">
                {logs.length === 0 && (
                    <div className="no-logs">
                        <Activity size={24} style={{ marginBottom: '10px' }} />
                        <div>Waiting for activity...</div>
                    </div>
                )}

                {logs.map(log => (
                    <div key={log.id} className="log-entry">
                        <div className="log-meta">
                            <span className="log-time">{formatTime(log.timestamp)}</span>
                            <span className={`log-type type-${log.type}`}>{log.type}</span>
                        </div>
                        <div className="log-message">{log.message}</div>
                        {log.details && <div className="log-details">{log.details}</div>}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </aside>
    );
}
