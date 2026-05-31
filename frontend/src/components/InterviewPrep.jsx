import React, { useState, useEffect } from 'react';
import axios from 'axios';

function InterviewPrep() {
  const [stories, setStories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const response = await axios.get('/api/prep/stories');
      setStories(response.data.stories);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="card">Loading...</div>;

  return (
    <div>
      <div className="card">
        <h2>🎓 Interview Prep - STAR Stories</h2>
        <div className="stats">
          <div className="stat-box">
            <h3>{stats?.totalStories || 0}</h3>
            <p>Stories</p>
          </div>
          <div className="stat-box">
            <h3>{stats?.rolesCount || 0}</h3>
            <p>Role Types</p>
          </div>
          <div className="stat-box">
            <h3>{stats?.highConfidence || 0}</h3>
            <p>High Confidence</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>📖 Your Stories</h2>
        {stories.length > 0 ? (
          <div className="grid">
            {stories.map((story, idx) => (
              <div key={idx} className="grid-item">
                <h3>{story.title}</h3>
                <p><strong>Result:</strong> {story.result}</p>
                <p><strong>Confidence:</strong> {story.confidence}</p>
                {story.roles && story.roles.length > 0 && (
                  <p><strong>For Roles:</strong> {story.roles.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No stories yet. Add your first STAR story using: !prep add | Title | Situation | Task | Action | Result | Reflection | High</p>
        )}
      </div>
    </div>
  );
}

export default InterviewPrep;
