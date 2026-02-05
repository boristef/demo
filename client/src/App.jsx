import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Database, Activity, Layout } from 'lucide-react';
import { LogViewer } from './components/LogViewer';
import './index.css';

const API_URL = 'http://localhost:3000/api/ask';

function App() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(true); // Default to TRUE for Demo
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const currentQuestion = question;
    setQuestion('');
    setLoading(true);

    // Add user message
    setHistory(prev => [...prev, { type: 'user', content: currentQuestion }]);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestion }),
      });

      const data = await response.json();

      if (response.ok) {
        setHistory(prev => [...prev, {
          type: 'bot',
          content: data.answer,
          sql: data.sql,
          error: data.error
        }]);
      } else {
        setHistory(prev => [...prev, {
          type: 'bot',
          content: null,
          error: data.error || 'Failed to fetch response'
        }]);
      }

    } catch (err) {
      setHistory(prev => [...prev, {
        type: 'bot',
        content: null,
        error: 'Network error. Is the backend running?'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (data) => {
    if (!Array.isArray(data) || data.length === 0) return <p className="text-gray-400">No results found.</p>;

    // Sort logic for verification query (Top 5) if needed, but SQL should handle it.
    const headers = Object.keys(data[0]);

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="results-table">
          <thead>
            <tr>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {headers.map(h => <td key={h}>{row[h]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app-layout" style={{
      gridTemplateColumns: showLogs ? '1fr 380px' : '1fr 0px',
      gap: showLogs ? '20px' : '0'
    }}>

      {/* Main Column: Header + Chat */}
      <div className="main-column">

        {/* Header */}
        <header className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Activity size={24} color="white" />
            </div>
            <div>
              <h1>TradeXchange AI</h1>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginTop: '4px' }}>
                Natural Language Trade Analytics
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Database size={14} color="#10b981" /> Online
            </span>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`logs-btn ${showLogs ? 'active' : ''}`}
              title="Toggle Logs Sidebar"
              style={{ width: 'auto', padding: '0 12px', borderRadius: '8px', gap: '8px' }}
            >
              <Layout size={18} /> {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="glass-panel chat-container">

          <div className="chat-history">
            {history.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '80px', opacity: 0.7 }}>
                <Terminal size={64} style={{ color: 'var(--primary)', marginBottom: '24px', opacity: 0.5 }} />
                <h2 style={{ fontWeight: 400 }}>Ask anything about global logistics stats.</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Try: "Show me the top 5 countries by logistics performance"</p>
              </div>
            )}

            {history.map((msg, idx) => (
              <div key={idx} className={`message ${msg.type}`}>
                <div className="bubble">
                  {msg.type === 'bot' && msg.sql && (
                    <div className="sql-badge">
                      &gt; {msg.sql}
                    </div>
                  )}

                  {msg.type === 'user' ? (
                    msg.content
                  ) : (
                    msg.error ? (
                      <span style={{ color: '#f87171' }}>Error: {msg.error}</span>
                    ) : (
                      renderTable(msg.content)
                    )
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message bot">
                <div className="bubble">
                  <div className="loading-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)', background: 'rgba(15, 23, 42, 0.4)' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                className="chat-input"
                placeholder="Ask a question about trade data..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <button type="submit" className="send-btn" disabled={loading || !question.trim()}>
                {loading ? '...' : <><Send size={18} /> Ask</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Log Sidebar (Conditionally Rendered or Hidden via Grid) */}
      {showLogs && <LogViewer />}

    </div>
  );
}

export default App;
