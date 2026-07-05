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

        // Check if response is HTML or 404
        const contentType = originalResponse.headers.get('content-type');
        const isHtmlResponse = contentType && contentType.includes('text/html');

        if (originalResponse.status === 404 || isHtmlResponse) {
          console.warn(`[Fetch Interceptor] Express API returned ${originalResponse.status} ${isHtmlResponse ? '(HTML response detected)' : ''}.`);
        }

        return originalResponse;
      } catch (networkError: any) {
        // If there's a connection error (Server is offline / Refused connection / Timeout / DNS error)
        console.error('[Fetch Interceptor] Network connection failed:', networkError);
        throw networkError;
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
