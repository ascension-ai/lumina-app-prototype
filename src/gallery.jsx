import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Gallery from './components/floating/Gallery';

// Dev-only entry point. `npm run dev` -> http://localhost:5173/gallery.html
createRoot(document.getElementById('gallery-root')).render(
  <StrictMode>
    <Gallery />
  </StrictMode>
);
