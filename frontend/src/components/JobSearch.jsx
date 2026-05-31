import React, { useState } from 'react';
import axios from 'axios';
import './JobSearch.css';

function JobSearch() {
  const [keywords, setKeywords] = useState('Python Developer');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/jobs/search', {
        params: { keywords, limit: 10 }
      });
      setJobs(response.data.jobs);
    } catch (err) {
      setError('Failed to search jobs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadgeColor = (score) => {
    switch (score) {
      case 'A': return '#28a745';
      case 'B': return '#17a2b8';
      case 'C': return '#ffc107';
      case 'D': return '#fd7e14';
      default: return '#dc3545';
    }
  };

  return (
    <div className="job-search">
      <div className="card">
        <h2>🔍 Job Search & Scoring</h2>
        <div className="search-form">
          <input
            type="text"
            placeholder="e.g., Python Developer, Data Engineer, Remote"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {jobs.length > 0 && (
        <div className="card">
          <h2>📊 Results ({jobs.length})</h2>
          <div className="jobs-list">
            {jobs.map((job, index) => (
              <div key={index} className="job-card">
                <div className="job-header">
                  <div className="job-title">
                    <h3>{job.title}</h3>
                    <p className="company">{job.company}</p>
                  </div>
                  <div className="job-score">
                    <div
                      className="score-badge"
                      style={{ backgroundColor: getScoreBadgeColor(job.match.overall_score) }}
                    >
                      {job.match.overall_score}
                    </div>
                    <p className="numeric-score">{job.match.numeric_score}/100</p>
                  </div>
                </div>

                <div className="job-meta">
                  <span className="meta-item">📍 {job.location}</span>
                  <span className="meta-item">{job.remote ? '🌐 Remote' : '🏢 On-site'}</span>
                  <span className="meta-item">💼 {job.type}</span>
                </div>

                <div className="recommendation">
                  <p>{job.match.recommendation?.emoji} {job.match.recommendation?.text}</p>
                </div>

                <div className="dimensions">
                  <div className="dimension">
                    <span>CV Match</span>
                    <div className="dimension-bar">
                      <div style={{ width: `${job.match.dimensions.cv_match?.score || 0}%` }}></div>
                    </div>
                  </div>
                  <div className="dimension">
                    <span>Location Fit</span>
                    <div className="dimension-bar">
                      <div style={{ width: `${job.match.dimensions.location_fit?.score || 0}%` }}></div>
                    </div>
                  </div>
                  <div className="dimension">
                    <span>Growth</span>
                    <div className="dimension-bar">
                      <div style={{ width: `${job.match.dimensions.growth?.score || 0}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="job-actions">
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn-link">
                    View Job
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && jobs.length === 0 && keywords && (
        <div className="card no-results">
          <p>No jobs found. Try different keywords!</p>
        </div>
      )}
    </div>
  );
}

export default JobSearch;
