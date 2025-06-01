import React from 'react';
import { FaHandWave } from 'react-icons/fa';

const UserWelcome = ({ user, lastLoginTime }) => {
  return (
    <div className="user-welcome">
      <div className="welcome-content">
        <FaHandWave className="welcome-icon" />
        <div className="welcome-text">
          <h2>Welcome back, {user.email}</h2>
          <p className="last-login">Last login: {new Date(lastLoginTime).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default UserWelcome; 