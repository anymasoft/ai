/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * layout.client.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

'use client'

import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { TopLoader, useTopLoader } from '@/components/ui/top-loader'
import { type ReactNode, Suspense, useEffect } from 'react'
import { mono } from './fonts'

// Declare type for window.trpc
declare global {
  interface Window {
    trpc?: {
      createTRPCNext: (opts: any) => any;
    };
  }
}

// Get global TopLoader instance
const globalLoader = { 
  start: () => {}, 
  done: () => {}, 
  set: (loader: { start: () => void; done: () => void }) => {
    globalLoader.start = loader.start;
    globalLoader.done = loader.done;
  } 
};

function RouterChecker() {
  const { start, done } = useTopLoader()
  const router = useRouter();
  
  // Set loader methods to global object for use by other monitoring components
  useEffect(() => {
    globalLoader.set({ start, done });
  }, [start, done]);

  useEffect(() => {
    const _push = router.push.bind(router);
    const _refresh = router.refresh.bind(router);

    router.push = (href, options) => {
      start();
      _push(href, options);
    };

    router.refresh = () => {
      start();
      _refresh();
    };
    
    // Return cleanup function to restore original methods if component unmounts
    return () => {
      router.push = _push;
      router.refresh = _refresh;
    };
  }, [router, start]);

  useEffect(() => {
    done();
  }, [done]);

  return null;
}

// Monitor all fetch requests
function FetchMonitor() {
  useEffect(() => {
    // Save original fetch
    const originalFetch = window.fetch;
    
    // Define active requests set
    const activeRequests = new Set<string>();
    
    // Override global fetch
    window.fetch = function(...args) {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      const requestId = `${url}_${Date.now()}`;
      
      // Start loading
      if (activeRequests.size === 0) {
        globalLoader.start();
      }
      
      activeRequests.add(requestId);
      
      // Call original fetch
      return originalFetch.apply(this, args)
        .then(response => {
          activeRequests.delete(requestId);
          
          // If no active requests, complete loading
          if (activeRequests.size === 0) {
            globalLoader.done();
          }
          
          return response;
        })
        .catch(error => {
          activeRequests.delete(requestId);
          
          // If no active requests, complete loading
          if (activeRequests.size === 0) {
            globalLoader.done();
          }
          
          throw error;
        });
    };
    
    // Cleanup function
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  return null;
}

export function Body({
  children,
}: {
  children: ReactNode
}): React.ReactElement<unknown> {
  return (
    <body className={`${mono.className} antialiased`}>
      <Suspense>
        <RouterChecker />
        <FetchMonitor />
      </Suspense>
      {process.env['NEXT_PUBLIC_SCAN'] && process.env['NEXT_PUBLIC_SCAN'] === '1' && (
        <Script src='https://unpkg.com/react-scan/dist/auto.global.js' async />
      )}
      <TopLoader />
      {children}
    </body>
  )
}