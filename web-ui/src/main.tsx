import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { queryClient } from '@/lib/queryClient';
import { routes } from '@/routes';
import '@/styles/global.css';

// Prevent browser long-press context menus & drag ghosting so the APK feels 100% native.
window.addEventListener(
  'contextmenu',
  (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
  },
  { passive: false },
);
window.addEventListener('dragstart', (e) => e.preventDefault());

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
