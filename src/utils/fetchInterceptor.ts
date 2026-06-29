import { clientFirebaseRouter } from './firebaseClient';

// Extend window interface
declare global {
  interface Window {
    __useClientFirebase?: boolean;
    __originalFetch?: typeof fetch;
  }
}

// Check initial flag from localStorage
const storedFlag = localStorage.getItem('forceClientFirebase');
window.__useClientFirebase = storedFlag === 'true';

if (!window.__originalFetch) {
  // Store reference to original fetch
  window.__originalFetch = window.fetch;

  // Define custom fetch implementation
  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // We only intercept relative API calls starting with /api/
    const isRelativeApi = urlString.startsWith('/api/') || urlString.startsWith('api/');
    
    if (isRelativeApi) {
      // Clean path
      const cleanPath = urlString.startsWith('api/') ? '/' + urlString : urlString;

      // Helper function to build a mock Fetch Response
      const makeMockResponse = (status: number, data: any): Response => {
        const bodyStr = JSON.stringify(data);
        return new Response(bodyStr, {
          status,
          statusText: status === 200 ? 'OK' : 'Error',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      };

      // 1. If we are already locked into client-side Firebase mode
      if (window.__useClientFirebase) {
        console.log(`[Fetch Interceptor] Direct Client Firestore Route: ${init?.method || 'GET'} ${cleanPath}`);
        try {
          const res = await clientFirebaseRouter.handleRequest(cleanPath, init?.method || 'GET', init?.body ? JSON.parse(init.body as string) : null);
          return makeMockResponse(res.status, res.data);
        } catch (err: any) {
          console.error('[Fetch Interceptor] Direct Client Firestore error:', err);
          return makeMockResponse(500, { success: false, message: err.message || 'Direct Client Firestore error' });
        }
      }

      // 2. Otherwise, attempt to call the normal Express backend API
      try {
        const originalResponse = await window.__originalFetch!(input, init);

        // If the server returns a 404 for an API route, it usually means 
        // the app is deployed in a static hosting environment (like Vercel) 
        // where the custom Express backend is not running at all.
        if (originalResponse.status === 404) {
          const bodyText = await originalResponse.clone().text();
          
          // Let's check if the body contains signs of hosting 404 (like Vercel NOT_FOUND)
          if (bodyText.includes('NOT_FOUND') || bodyText.includes('Vercel') || bodyText.toLowerCase().includes('not found') || bodyText.includes('sin1::')) {
            console.warn('[Fetch Interceptor] Express server not found (404 Vercel/Static). Switching to direct client-side Firestore Mode!');
            
            // Activate the fallback
            window.__useClientFirebase = true;
            localStorage.setItem('forceClientFirebase', 'true');

            // Handle the request directly
            const res = await clientFirebaseRouter.handleRequest(cleanPath, init?.method || 'GET', init?.body ? JSON.parse(init.body as string) : null);
            return makeMockResponse(res.status, res.data);
          }
        }

        return originalResponse;
      } catch (networkError: any) {
        // If there's a connection error (Server is offline / Refused connection / Timeout / DNS error)
        console.warn('[Fetch Interceptor] Network connection failed. Switching to direct client-side Firestore Mode!', networkError);
        
        // Activate the fallback
        window.__useClientFirebase = true;
        localStorage.setItem('forceClientFirebase', 'true');

        // Handle the request directly
        try {
          const res = await clientFirebaseRouter.handleRequest(cleanPath, init?.method || 'GET', init?.body ? JSON.parse(init.body as string) : null);
          return makeMockResponse(res.status, res.data);
        } catch (fallbackError: any) {
          return makeMockResponse(500, { success: false, message: 'Fallback to direct client-side Firestore failed' });
        }
      }
    }

    // Default fetch for non-API assets (JS, CSS, Images, etc.)
    return window.__originalFetch!(input, init);
  };

  // Override window.fetch using Object.defineProperty to shadow the native getter
  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      configurable: true,
      writable: true
    });
  } catch (e) {
    console.warn('[Fetch Interceptor] Object.defineProperty failed, attempting direct assignment:', e);
    try {
      window.fetch = customFetch;
    } catch (err2) {
      console.error('[Fetch Interceptor] Critical: Failed to override window.fetch entirely:', err2);
    }
  }
}
