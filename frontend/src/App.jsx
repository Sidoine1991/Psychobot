import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Dashboard from './components/Dashboard';
import JobSearch from './components/JobSearch';
import Tracker from './components/Tracker';
import InterviewPrep from './components/InterviewPrep';
import Batch from './components/Batch';

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs', label: '🔍 Job Search' },
    { id: 'batch', label: '⚡ Batch' },
    { id: 'tracker', label: '📋 Tracker' },
    { id: 'prep', label: '🎓 Interview Prep' }
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 PsychoBot</h1>
          <p>Career-Ops Job Search Dashboard</p>
        </div>
      </header>

      <nav className="app-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => setCurrentTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {currentTab === 'dashboard' && <Dashboard stats={stats} />}
            {currentTab === 'jobs' && <JobSearch onJobsFound={() => loadStats()} />}
            {currentTab === 'batch' && <Batch onBatchComplete={() => loadStats()} />}
            {currentTab === 'tracker' && <Tracker stats={stats} />}
            {currentTab === 'prep' && <InterviewPrep />}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>PsychoBot v1.0 | Career-Ops Integration | Built with React</p>
      </footer>
    </div>
  );
}

export default App;
