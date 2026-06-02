import React, { useState } from 'react';

function Batch() {
  return (
    <div className="card">
      <h2>⚡ Batch Processing</h2>
      <p>Batch processing allows you to search and score 50+ job offers in parallel.</p>
      <p>Use the WhatsApp bot command: <code>!batch search keyword1 keyword2</code></p>
      <p>Or check the API: <code>POST /api/batch/process</code></p>
    </div>
  );
}

export default Batch;
