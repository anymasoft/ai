import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"
import "../style.css"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  css: ["../style.css"]
}

// Types
interface Subtitle {
  index: number
  time: string
  text: string
  start: number
  end: number
}

interface Language {
  code: string
  name: string
}

// Supported languages
const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'ru', name: 'Russian' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' }
]

// Flags SVG (simplified, inline)
const FLAGS_SVG: Record<string, string> = {
  ru: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 6"><path fill="#fff" d="M0 0h9v6H0z"/><path fill="#0039a6" d="M0 2h9v4H0z"/><path fill="#d52b1e" d="M0 4h9v2H0z"/></svg>`,
  en: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><clipPath id="a"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="b"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#a)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="m0 0 60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="m0 0 60 30m0-30L0 30" clip-path="url(#b)" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>`,
  es: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500"><path fill="#c60b1e" d="M0 0h750v500H0z"/><path fill="#ffc400" d="M0 125h750v250H0z"/></svg>`,
  de: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><path d="M0 0h5v3H0z"/><path fill="#D00" d="M0 1h5v2H0z"/><path fill="#FFCE00" d="M0 2h5v1H0z"/></svg>`,
  fr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><path fill="#ED2939" d="M0 0h900v600H0z"/><path fill="#fff" d="M0 0h600v600H0z"/><path fill="#002395" d="M0 0h300v600H0z"/></svg>`,
  ja: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><path fill="#fff" d="M0 0h900v600H0z"/><circle fill="#bc002d" cx="450" cy="300" r="180"/></svg>`,
  zh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><path fill="#de2910" d="M0 0h30v20H0z"/><path fill="#ffde00" d="m5 3 .9 2.8h2.9l-2.4 1.7.9 2.8-2.3-1.7-2.4 1.7.9-2.8-2.3-1.7H5zm5.4 7.7.4-.9.8.5-.3-.9.7-.5h-1l-.3-.9-.3.9h-.9l.7.5zm1.1-2-.3.9.7.5H11l.4.9.4-.9h.9l-.7-.5.3-.9-.8.5zm1.1 3.8.4-.9-.8-.5 1 0 .3-.9.3.9H14l-.7.5.3.9-.7-.5zm-4.1-.5-.3.9.7.5h-1l.4.9.4-.9h.9l-.7-.5.3-.9-.7.5z"/></svg>`,
  it: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><path fill="#009246" d="M0 0h3v2H0z"/><path fill="#fff" d="M1 0h2v2H1z"/><path fill="#ce2b37" d="M2 0h1v2H2z"/></svg>`,
  pt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><path fill="#060" d="M0 0h600v400H0z"/><path fill="#D52B1E" d="M0 0h240v400H0z"/><circle cx="240" cy="200" r="80" fill="#FAF20A"/><path fill="#D52B1E" d="M240 160a40 40 0 0 0 0 80 45 45 0 0 0 0-80z"/><circle cx="240" cy="200" r="30" fill="#fff"/></svg>`
}

// Helper: get video ID from URL
const getVideoId = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('v')
}

// Helper: parse time string to seconds
const parseTimeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(':').reverse()
  return (
    parseInt(parts[0] || '0') +
    parseInt(parts[1] || '0') * 60 +
    parseInt(parts[2] || '0') * 3600
  )
}

// Helper: format seconds to SRT time
const formatSRTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

// Helper: format seconds to VTT time
const formatVTTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

// Helper: generate SRT content
const generateSRT = (subtitles: Subtitle[]): string => {
  let srt = ''
  subtitles.forEach((sub, index) => {
    srt += `${index + 1}\n`
    srt += `${formatSRTTime(sub.start)} --> ${formatSRTTime(sub.end)}\n`
    srt += `${sub.text}\n\n`
  })
  return srt
}

// Helper: generate VTT content
const generateVTT = (subtitles: Subtitle[]): string => {
  let vtt = 'WEBVTT\n\n'
  subtitles.forEach((sub) => {
    vtt += `${formatVTTTime(sub.start)} --> ${formatVTTTime(sub.end)}\n`
    vtt += `${sub.text}\n\n`
  })
  return vtt
}

// Helper: generate TXT content
const generateTXT = (subtitles: Subtitle[]): string => {
  return subtitles.map(sub => sub.text).join('\n')
}

// Helper: download file
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Main VideoReader Panel Component
const VideoReaderPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [selectedLang, setSelectedLang] = useState('ru')
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentActiveIndex, setCurrentActiveIndex] = useState(-1)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Load saved language from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('yt-reader-lang')
    if (saved && SUPPORTED_LANGUAGES.find(l => l.code === saved)) {
      setSelectedLang(saved)
    }
  }, [])

  // Save language when changed
  useEffect(() => {
    localStorage.setItem('yt-reader-lang', selectedLang)
  }, [selectedLang])

  // Get transcript from YouTube
  const getTranscript = async (): Promise<Subtitle[] | null> => {
    console.log('Getting transcript...')

    // Find transcript button
    const transcriptButton = document.querySelector<HTMLButtonElement>(
      '#description ytd-video-description-transcript-section-renderer button[aria-label*="transcript" i], ' +
      '#description ytd-video-description-transcript-section-renderer button[aria-label*="текст" i], ' +
      'ytd-video-description-transcript-section-renderer button'
    )

    if (!transcriptButton) {
      return null // No subtitles available
    }

    const isOpen = transcriptButton.getAttribute('aria-pressed') === 'true'

    // Open transcript panel if not open
    if (!isOpen) {
      transcriptButton.click()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Wait for transcript items to load
    await new Promise(resolve => setTimeout(resolve, 500))

    const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer')
    console.log('Found transcript items:', transcriptItems.length)

    if (transcriptItems.length === 0) {
      throw new Error('Transcript items not found')
    }

    const subtitles: Subtitle[] = []
    transcriptItems.forEach((item, index) => {
      const timeElement = item.querySelector('.segment-timestamp')
      const textElement = item.querySelector('yt-formatted-string.segment-text')

      if (textElement) {
        const text = textElement.textContent?.trim() || ''
        const timeText = timeElement?.textContent?.trim() || ''

        // Get start time
        const startAttr = item.getAttribute('start-offset')
        let startSeconds = 0
        if (startAttr) {
          startSeconds = parseFloat(startAttr) / 1000
        } else {
          startSeconds = parseTimeToSeconds(timeText)
        }

        subtitles.push({
          index,
          time: timeText,
          text,
          start: startSeconds,
          end: startSeconds + 5 // Will be updated
        })
      }
    })

    // Update end times
    for (let i = 0; i < subtitles.length - 1; i++) {
      subtitles[i].end = subtitles[i + 1].start
    }

    // Close transcript panel
    if (!isOpen) {
      transcriptButton.click()
    }

    console.log('Got subtitles:', subtitles.length)
    return subtitles
  }

  // Translate subtitles line by line
  const translateSubtitles = async (videoId: string, subs: Subtitle[]) => {
    const SERVER_URL = 'http://localhost:5000/translate-line'
    const prevContext: string[] = []

    console.log(`Starting translation to ${selectedLang}...`)

    for (let i = 0; i < subs.length; i++) {
      const subtitle = subs[i]

      try {
        const response = await fetch(SERVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoId,
            lineNumber: i,
            text: subtitle.text,
            prevContext: prevContext.slice(-2),
            lang: selectedLang
          })
        })

        if (!response.ok) {
          console.error(`Translation error for line ${i}:`, response.status)
          prevContext.push(subtitle.text)
          continue
        }

        const data = await response.json()
        const translatedText = data.text

        if (data.cached) {
          console.log(`[${i}] Cache: ${translatedText}`)
        } else {
          console.log(`[${i}] Translated: ${translatedText}`)
        }

        // Update subtitle in state
        setSubtitles(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], text: translatedText }
          return updated
        })

        prevContext.push(translatedText)

        if (!data.cached) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      } catch (error) {
        console.error(`Error translating line ${i}:`, error)
        prevContext.push(subtitle.text)
      }
    }

    console.log(`Translation complete: ${subs.length} lines to ${selectedLang}`)
  }

  // Handle translate button click
  const handleTranslate = async () => {
    const videoId = getVideoId()
    if (!videoId) {
      setError('Failed to get video ID')
      return
    }

    if (isLoading || isTranslating) return

    setIsLoading(true)
    setError(null)
    setSubtitles([])

    try {
      const subs = await getTranscript()

      if (subs === null) {
        setError('Subtitles not available for this video')
        setIsLoading(false)
        return
      }

      if (!subs || subs.length === 0) {
        setError('No subtitles found')
        setIsLoading(false)
        return
      }

      // Display original subtitles first
      setSubtitles(subs)
      setIsLoading(false)

      // Start translation
      setIsTranslating(true)
      await translateSubtitles(videoId, subs)
      setIsTranslating(false)
    } catch (err) {
      console.error('Error getting transcript:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
      setIsTranslating(false)
    }
  }

  // Realtime highlighting system
  useEffect(() => {
    if (subtitles.length === 0) return

    videoRef.current = document.querySelector('video')
    if (!videoRef.current) return

    let lastUpdateTime = 0
    const throttleDelay = 120
    let lastScrollTime = 0
    const scrollThrottle = 800

    const updateHighlight = () => {
      const video = videoRef.current
      if (!video) return

      const now = performance.now()
      if (now - lastUpdateTime < throttleDelay) {
        animationFrameRef.current = requestAnimationFrame(updateHighlight)
        return
      }

      lastUpdateTime = now
      const currentTime = video.currentTime

      // Find active subtitle
      let activeIndex = -1
      for (let i = 0; i < subtitles.length; i++) {
        const sub = subtitles[i]
        if (currentTime >= sub.start && currentTime < sub.end) {
          activeIndex = i
          break
        }
      }

      // Update active index and karaoke progress
      if (activeIndex !== currentActiveIndex) {
        setCurrentActiveIndex(activeIndex)

        // Scroll to active element
        if (activeIndex !== -1 && now - lastScrollTime >= scrollThrottle) {
          const activeElement = document.querySelector(`[data-index="${activeIndex}"]`)
          if (activeElement && contentRef.current) {
            const elementRect = activeElement.getBoundingClientRect()
            const containerRect = contentRef.current.getBoundingClientRect()

            const isVisible =
              elementRect.top >= containerRect.top &&
              elementRect.bottom <= containerRect.bottom

            if (!isVisible) {
              activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              })
            }
          }
          lastScrollTime = now
        }
      }

      // Update karaoke progress
      if (activeIndex !== -1) {
        const sub = subtitles[activeIndex]
        const duration = sub.end - sub.start
        if (duration > 0) {
          const elapsed = currentTime - sub.start
          const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100))
          const activeElement = document.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement
          if (activeElement) {
            activeElement.style.setProperty('--karaoke-progress', `${progress}%`)
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateHighlight)
    }

    animationFrameRef.current = requestAnimationFrame(updateHighlight)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [subtitles, currentActiveIndex])

  // Handle subtitle click to seek
  const handleSubtitleClick = (time: string) => {
    const seconds = parseTimeToSeconds(time)
    const video = document.querySelector('video')
    if (video) {
      video.currentTime = seconds
      video.play()
    }
  }

  // Handle export
  const handleExport = (format: 'srt' | 'vtt' | 'txt') => {
    if (subtitles.length === 0) return

    const videoId = getVideoId()
    let content: string
    let filename: string
    let mimeType: string

    switch (format) {
      case 'srt':
        content = generateSRT(subtitles)
        filename = `${videoId}_${selectedLang}_translated.srt`
        mimeType = 'text/plain;charset=utf-8'
        break
      case 'vtt':
        content = generateVTT(subtitles)
        filename = `${videoId}_${selectedLang}_translated.vtt`
        mimeType = 'text/vtt;charset=utf-8'
        break
      case 'txt':
        content = generateTXT(subtitles)
        filename = `${videoId}_${selectedLang}_translated.txt`
        mimeType = 'text/plain;charset=utf-8'
        break
    }

    downloadFile(content, filename, mimeType)
    setShowExportDropdown(false)
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_LANGUAGES[0]

  return (
    <div className="bg-[var(--yt-spec-base-background)] rounded-xl mb-4 border border-[var(--yt-spec-10-percent-layer)] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-center px-5 py-4 border-b border-[var(--yt-spec-10-percent-layer)] relative">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-extrabold text-[var(--yt-spec-text-primary)] tracking-tight">
              VideoReader
            </span>
          </div>
          <div className="text-xs font-medium text-[var(--yt-spec-text-secondary)] opacity-70 ml-0">
            AI Translator for YouTube
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md hover:bg-[rgba(0,0,0,0.05)] transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d={isCollapsed ? "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" : "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"} />
          </svg>
        </button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="p-4">
          {/* Controls */}
          <div className="flex gap-2 mb-4 items-center">
            <button
              onClick={handleTranslate}
              disabled={isLoading || isTranslating}
              className={`flex-1 h-8 px-3 rounded-lg font-semibold text-sm transition-all ${
                isLoading || isTranslating
                  ? 'bg-gray-200 text-gray-900 cursor-not-allowed vr-pulse'
                  : 'bg-black text-white hover:opacity-90'
              }`}
            >
              {isLoading ? 'Loading...' : isTranslating ? 'AI is translating...' : 'Translate Video'}
            </button>

            {/* Export button */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={subtitles.length === 0 || isLoading || isTranslating}
                className="h-8 px-3 rounded-2xl border border-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[120px] z-50">
                  {['srt', 'vtt', 'txt'].map(fmt => (
                    <div
                      key={fmt}
                      onClick={() => handleExport(fmt as any)}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 cursor-pointer transition-all"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-sm font-medium">{fmt.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="h-8 px-3 rounded-2xl border border-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.03)] flex items-center gap-2 transition-all shadow-sm"
              >
                <div className="w-5 h-4 rounded overflow-hidden" dangerouslySetInnerHTML={{ __html: FLAGS_SVG[currentLang.code] }} />
                <span className="text-xs font-semibold uppercase">{currentLang.code}</span>
                <svg className={`w-3 h-3 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showLangDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[220px] max-h-[320px] overflow-y-auto z-50">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <div
                      key={lang.code}
                      onClick={() => {
                        setSelectedLang(lang.code)
                        setShowLangDropdown(false)
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md cursor-pointer transition-all ${
                        lang.code === selectedLang ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-5 rounded overflow-hidden shadow-sm" dangerouslySetInnerHTML={{ __html: FLAGS_SVG[lang.code] }} />
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-gray-500">{lang.code}</span>
                        <span className="text-sm font-medium">{lang.name}</span>
                      </div>
                      {lang.code === selectedLang && (
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div ref={contentRef} className="max-h-[600px] overflow-y-auto vr-scrollbar">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-500 rounded-full vr-spinner" />
                <span className="text-sm font-medium text-gray-600">Loading transcript...</span>
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {subtitles.length > 0 && !isLoading && (
              <div className="space-y-0.5">
                {subtitles.map((sub) => (
                  <div
                    key={sub.index}
                    data-index={sub.index}
                    onClick={() => handleSubtitleClick(sub.time)}
                    className={`flex gap-2.5 p-1.5 rounded-md cursor-pointer transition-all vr-fade-in ${
                      currentActiveIndex === sub.index
                        ? 'vr-active-subtitle bg-gradient-to-r from-indigo-100/80 to-indigo-50/80 border-l-3 border-indigo-500 shadow-sm'
                        : 'hover:bg-gray-50'
                    }`}
                    style={{ animationDelay: `${sub.index * 20}ms` }}
                  >
                    <div className={`px-1 py-0.5 text-xs font-medium rounded ${
                      currentActiveIndex === sub.index
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-blue-600'
                    }`}>
                      {sub.time}
                    </div>
                    <div className="flex-1 text-sm leading-relaxed text-[var(--yt-spec-text-primary)] pt-0.5">
                      {sub.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Plasmo CSUI component
export default VideoReaderPanel

// Mount point
export const getRootContainer = () => {
  // Wait for YouTube secondary panel
  return new Promise<Element>((resolve) => {
    const checkExist = setInterval(() => {
      const secondary = document.querySelector('#secondary-inner, #secondary')
      if (secondary) {
        clearInterval(checkExist)

        // Create wrapper div
        const wrapper = document.createElement('div')
        wrapper.id = 'video-reader-root'
        secondary.insertBefore(wrapper, secondary.firstChild)

        resolve(wrapper)
      }
    }, 100)
  })
}
