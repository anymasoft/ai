/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * text-gif.tsx
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

import { type VariantProps, cva } from 'class-variance-authority'
import Image from 'next/image'
import React, { useEffect, useMemo, useState, type CSSProperties, createContext, useContext } from 'react'

import { cn } from '@libra/ui/lib/utils'

// Define text style variants
const textBaseVariants = cva('', {
  variants: {
    size: {
      default: 'text-2xl sm:text-3xl lg:text-4xl',
      xxs: 'text-base sm:text-lg lg:text-lg',
      xs: 'text-lg sm:text-xl lg:text-2xl',
      sm: 'text-xl sm:text-2xl lg:text-3xl',
      md: 'text-2xl sm:text-3xl lg:text-4xl',
      lg: 'text-3xl sm:text-4xl lg:text-5xl',
      xl: 'text-4xl sm:text-5xl lg:text-6xl',
      xxl: 'text-[2.5rem] sm:text-6xl lg:text-[6rem]',
      xll: 'text-5xl sm:text-6xl lg:text-[7rem]',
      xxxl: 'text-[6rem] leading-5 lg:leading-8 sm:text-6xl lg:text-[8rem]',
    },
    weight: {
      default: 'font-bold',
      thin: 'font-thin',
      base: 'font-base',
      semi: 'font-semibold',
      bold: 'font-bold',
      black: 'font-black',
    },
    font: {
      default: 'font-sansTight',
      serif: 'font-serif',
      mono: 'font-mono',
    },
  },
  defaultVariants: {
    size: 'default',
    weight: 'bold',
    font: 'default',
  },
})

// Export common GIF URLs
const gifUrls = ['/logo-background.gif']

// Create preload state context
type PreloadContextType = {
  preloadedGifs: Record<string, boolean>;
  setGifLoaded: (url: string) => void;
};

const PreloadContext = createContext<PreloadContextType>({
  preloadedGifs: {},
  setGifLoaded: () => {},
});

// Preload state provider component
export function GifPreloadProvider({ children }: { children: React.ReactNode }) {
  const [preloadedGifs, setPreloadedGifs] = useState<Record<string, boolean>>({});
  
  const setGifLoaded = (url: string) => {
    setPreloadedGifs(prev => ({ ...prev, [url]: true }));
  };
  
  return (
    <PreloadContext.Provider value={{ preloadedGifs, setGifLoaded }}>
      {children}
    </PreloadContext.Provider>
  );
}

// Hook to use preloaded state
function usePreloadedGifs() {
  return useContext(PreloadContext);
}

interface TextGifProps extends VariantProps<typeof textBaseVariants> {
  gifUrl?: string
  text: string
  className?: string
  fallbackColor?: string
  transitionDuration?: number
}

const TextGif = React.memo(function TextGifComponent({
  gifUrl = gifUrls[0],
  text,
  size,
  weight,
  font,
  className,
  fallbackColor = 'black',
  transitionDuration = 300,
}: TextGifProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const { preloadedGifs } = usePreloadedGifs();
  
  // If GIF is preloaded, set loaded state directly
  useEffect(() => {
    if (gifUrl && preloadedGifs[gifUrl]) {
      setLoaded(true);
      setError(false);
    } else if (gifUrl) { // Ensure gifUrl exists
      // Even if not preloaded, try to load immediately, compatible with SSR environment
      if (typeof document !== 'undefined') {
        const img = document.createElement('img');
        img.onload = () => {
          setLoaded(true);
          setError(false);
        };
        img.onerror = () => {
          setError(true);
          setLoaded(false);
        };
        img.src = gifUrl;
      }
    }
  }, [gifUrl, preloadedGifs]);

  // Force initial GIF display (optimize immediate display effect)
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    // Delay 50ms to force display, avoid flickering
    const timer = setTimeout(() => {
      setForceShow(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Memoize className for performance
  const textClassName = useMemo(
    () =>
      cn(
        textBaseVariants({ size, weight, font }),
        (loaded && !error) || forceShow ? 'text-transparent bg-clip-text' : '',
        className,
        'pb-1.5 md:pb-4'
      ),
    [size, weight, font, className, loaded, error, forceShow]
  )

  // Memoize style for performance
  const textStyle = useMemo(() => {
    const style: CSSProperties = {
      backgroundSize: '125%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      WebkitBackgroundClip: 'text',
      lineHeight: 1,
      textAlign: 'center',
      color: fallbackColor,
      WebkitTextFillColor: fallbackColor,
      transition: `background-image ${transitionDuration}ms ease-in-out, color ${transitionDuration}ms ease-in-out`,
    }

    if ((loaded && !error) || forceShow) {
      style.backgroundImage = `url(${gifUrl})`;
      style.color = 'transparent';
      style.WebkitTextFillColor = 'transparent';
    }

    return style
  }, [loaded, error, gifUrl, transitionDuration, fallbackColor, forceShow])

  return (
    <div className='relative inline-block'>
      {/* Hidden image for preloading */}
      {gifUrl && (
        <Image
          src={gifUrl}
          alt=''
          width={1}
          height={1}
          className='absolute opacity-0 pointer-events-none'
          onLoad={() => {
            setLoaded(true)
            setError(false)
          }}
          onError={() => {
            setError(true)
            setLoaded(false)
          }}
          priority
          unoptimized
        />
      )}
      <span className={textClassName} style={textStyle}>
        {text}
      </span>
    </div>
  )
})

// Preloader component - now exported for use
export function PreloadGifs({ display = false }: { display?: boolean }) {
  const { setGifLoaded } = usePreloadedGifs();
  
  return (
    <div className={display ? 'block' : 'hidden'}>
      {gifUrls.map((url) => (
        <Image 
          key={url} 
          src={url} 
          alt='' 
          width={display ? 100 : 1} 
          height={display ? 100 : 1}
          priority 
          unoptimized
          onLoad={() => setGifLoaded(url)}
        />
      ))}
    </div>
  )
}

export { TextGif }
