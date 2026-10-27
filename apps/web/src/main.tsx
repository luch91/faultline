import React from 'react';
import { createRoot } from 'react-dom/client';
import FaultlineApp from './FaultlineApp';
import './style.css';
import './visual.css';
import './fidelity.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><FaultlineApp /></React.StrictMode>);
