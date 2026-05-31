import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

function Dashboard({ stats }) {
  if (!stats) return <div>Loading...</div>;

  const { jobs, track, prep } = stats;

  // Chart data for applications by status
  const statusData = [
    { name: 'Applied', value: track.applied || 0 },
    { name: 'Contacted', value: track.contacted || 0 },
    { name: 'Interview', value: track.interview || 0 },
    { name: 'Offered', value: track.offered || 0 },
    { name: 'Rejected', value: track.rejected || 0 }
  ];

  const COLORS = ['#ffc658', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

  return (
    <div className="dashboard">
      <h1>📊 Dashboard Overview</h1>

      {/* Key Stats */}
      <div className="stats">
        <div className="stat-box">
          <h3>{track.total || 0}</h3>
          <p>Total Applications</p>
        </div>
        <div className="stat-box">
          <h3>{track.interview || 0}</h3>
          <p>Interviews</p>
        </div>
        <div className="stat-box">
          <h3>{track.offered || 0}</h3>
          <p>Offers</p>
        </div>
        <div className="stat-box">
          <h3>{prep.totalStories || 0}</h3>
          <p>STAR Stories</p>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <h2>📈 Application Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData.filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>📊 Pipeline Status</h2>
          <div className="pipeline-info">
            <div className="pipeline-stage">
              <span className="stage-name">Applied</span>
              <span className="stage-count">{track.applied || 0}</span>
              <div className="stage-bar" style={{ width: `${(track.applied || 0) * 10}%` }}></div>
            </div>
            <div className="pipeline-stage">
              <span className="stage-name">Interview</span>
              <span className="stage-count">{track.interview || 0}</span>
              <div className="stage-bar" style={{ width: `${(track.interview || 0) * 20}%`, backgroundColor: '#82ca9d' }}></div>
            </div>
            <div className="pipeline-stage">
              <span className="stage-name">Offer</span>
              <span className="stage-count">{track.offered || 0}</span>
              <div className="stage-bar" style={{ width: `${(track.offered || 0) * 50}%`, backgroundColor: '#ffc658' }}></div>
            </div>
            <div className="conversion">
              <p>Conversion: {track.total > 0 ? ((track.interview / track.total) * 100).toFixed(1) : 0}% to Interview</p>
              <p>Offer Rate: {track.total > 0 ? ((track.offered / track.total) * 100).toFixed(1) : 0}% of Applied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2>🚀 Quick Actions</h2>
        <div className="quick-actions">
          <a href="#jobs" className="action-btn">
            <span className="action-icon">🔍</span>
            <span className="action-text">Search Jobs</span>
            <span className="action-desc">Find & score new opportunities</span>
          </a>
          <a href="#batch" className="action-btn">
            <span className="action-icon">⚡</span>
            <span className="action-text">Batch Process</span>
            <span className="action-desc">Process 50+ offers at once</span>
          </a>
          <a href="#tracker" className="action-btn">
            <span className="action-icon">📋</span>
            <span className="action-text">Track Follow-ups</span>
            <span className="action-desc">See follow-up suggestions</span>
          </a>
          <a href="#prep" className="action-btn">
            <span className="action-icon">🎓</span>
            <span className="action-text">Interview Prep</span>
            <span className="action-desc">Review STAR stories</span>
          </a>
        </div>
      </div>

      {/* Tips */}
      <div className="card tips-card">
        <h2>💡 Pro Tips</h2>
        <ul>
          <li><strong>Batch Search:</strong> Process 50+ offers in 2-3 minutes</li>
          <li><strong>Follow-up Cadence:</strong> Auto-suggestions at 7, 14, 21, 30 days</li>
          <li><strong>Interview Prep:</strong> Add STAR stories after each application</li>
          <li><strong>Score High:</strong> Aim for A-rated (90+) and B-rated (80+) roles</li>
          <li><strong>Track Everything:</strong> Monitor your conversion rate from Applied → Offer</li>
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;
