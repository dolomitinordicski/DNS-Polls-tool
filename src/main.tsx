import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initDNSPollsFoundation } from './lib/foundation';
import './index.css';

initDNSPollsFoundation();

createRoot(document.getElementById('root')!).render(<App />);
