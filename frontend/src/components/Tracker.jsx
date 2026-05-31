import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Tracker() {
  const [applications, setApplications] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appsRes, suggestRes] = await Promise.all([
        axios.get('/api/track/applications'),
        axios.get('/api/track/suggestions')
      ]);
      setApplications(appsRes.data.applications);
      setSuggestions(suggestRes.data.suggestions);
    } catch (error) {
      console.error('Error loading tracker data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="card">Loading...</div>;

  return (
    <div>
      <div className="card">
        <h2>📋 Application Tracker</h2>
        <p>Total Applications: {applications.length}</p>

        {applications.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Company</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Role</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Score</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Days Ago</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem' }}>{app.company}</td>
                    <td style={{ padding: '0.75rem' }}>{app.role}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge badge-${app.status.toLowerCase().replace(' ', '-')}`}>
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge badge-${app.score.toLowerCase()}`}>
                        {app.score}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{app.daysAgo || 0}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {suggestions && (
        <div className="card">
          <h2>📞 Follow-up Suggestions</h2>

          {suggestions.now && suggestions.now.length > 0 && (
            <div>
              <h3>🔴 Act Now ({suggestions.now.length})</h3>
              <p>These need follow-up today!</p>
              <ul>
                {suggestions.now.map((s, i) => (
                  <li key={i}>{s.company} - {s.role}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.thisWeek && suggestions.thisWeek.length > 0 && (
            <div>
              <h3>🟡 This Week ({suggestions.thisWeek.length})</h3>
              <p>Prepare follow-ups for these soon</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Tracker;
