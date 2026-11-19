import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './index.css';
import './styles/doc-themes.css';
import './styles/print-preview.css';
import { App } from './App';
import { PrintHost } from './components/PrintHost';

const isPrintMode = new URLSearchParams(window.location.search).get('mode') === 'print';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrintMode ? <PrintHost /> : <App />}
  </StrictMode>,
);
