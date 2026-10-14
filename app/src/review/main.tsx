/**
 * The editor's review queue. DEVELOPMENT ONLY: this module is the entry of the
 * /review page that the Vite dev server generates (scripts/review-middleware.mjs).
 * Nothing in the app imports it, so it never reaches dist/.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewApp } from './ReviewApp';
import '../styles.css';
import './review.css';

const root = document.getElementById('review-root');
if (!root) throw new Error('#review-root missing');
createRoot(root).render(
  <StrictMode>
    <ReviewApp />
  </StrictMode>,
);
