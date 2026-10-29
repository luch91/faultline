import React from 'react';
import { createRoot } from 'react-dom/client';
import FaultlineApp from './FaultlineApp';
import './network/network.css';
import './network/desktop.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><FaultlineApp /></React.StrictMode>);
