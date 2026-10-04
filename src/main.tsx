import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ServicesProvider, defaultServices } from './services';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/playfair-display/600-italic.css';
import '@fontsource/playfair-display/700-italic.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={defaultServices}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
