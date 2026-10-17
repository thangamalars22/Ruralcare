import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// restore accessibility text size
const size = localStorage.getItem('rc_text') || 'normal';
document.documentElement.dataset.text = size;

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
