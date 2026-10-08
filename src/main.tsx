import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ServicesProvider, defaultServices } from './services';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/playfair-display/600-italic.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/josefin-sans/400.css';
import '@fontsource/josefin-sans/600.css';
import '@fontsource/parisienne/400.css';
// Free stand-ins for the paid Canva fonts, listed after the real name in holding-styles.json
import '@fontsource/monsieur-la-doulaise/400.css';
import '@fontsource/sacramento/400.css';
import '@fontsource/hurricane/400.css';
import '@fontsource/bodoni-moda/400.css';
import '@fontsource/gilda-display/400.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/gloock/400.css';
import '@fontsource/prata/400.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={defaultServices}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
