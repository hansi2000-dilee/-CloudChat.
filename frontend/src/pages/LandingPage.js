// src/pages/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>CloudChat</h1>
        <p>The simplest, fastest way to stay connected with your friends and teams in real-time.</p>
        <button onClick={() => navigate('/login')}>Start Chatting</button>
      </div>
    </div>
  );
};

export default LandingPage;
