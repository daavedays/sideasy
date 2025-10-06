/**
 * Main Entry Point
 * 
 * This is the main entry point for the Sideasy Scheduler React application.
 * It initializes Firebase services and renders the root App component.
 * 
 * Location: src/main.tsx
 * Purpose: Application entry point with Firebase initialization
 */

import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize Firebase services
import './firebase_config/firebaseConfig.ts'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
