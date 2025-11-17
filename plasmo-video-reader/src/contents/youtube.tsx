import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"

import styleText from "data-text:~/style.css"

// Конфигурация контент-скрипта для YouTube
export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  all_frames: false
}

// Подключаем стили
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

// Определяем, куда монтировать наш компонент
export const getRootContainer = () => {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // Ищем панель с транскрипцией YouTube
      const transcriptPanel = document.querySelector(
        "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-structured-description']"
      ) || document.querySelector(
        "ytd-transcript-renderer"
      ) || document.querySelector(
        "#panels ytd-engagement-panel-section-list-renderer"
      )

      if (transcriptPanel) {
        clearInterval(checkInterval)

        // Создаём контейнер для нашей панели
        const container = document.createElement("div")
        container.id = "video-reader-root"
        container.style.cssText = `
          position: relative;
          width: 100%;
          margin-top: 16px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `

        // Вставляем наш контейнер после панели транскрипции
        transcriptPanel.parentElement?.insertBefore(
          container,
          transcriptPanel.nextSibling
        )

        resolve(container)
      }
    }, 1000)

    // Таймаут на случай, если транскрипция не найдена
    setTimeout(() => {
      clearInterval(checkInterval)
      // Создаём контейнер в body как запасной вариант
      const fallbackContainer = document.createElement("div")
      fallbackContainer.id = "video-reader-root-fallback"
      document.body.appendChild(fallbackContainer)
      resolve(fallbackContainer)
    }, 30000)
  })
}

interface SubtitleLine {
  text: string
  timestamp: number
  translation?: string
  isLoading?: boolean
}

interface TranslationCache {
  [key: string]: string
}

const BACKEND_URL = "http://localhost:5000"

// Основной компонент Video Reader
const VideoReaderPanel = () => {
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [translationCache, setTranslationCache] = useState<TranslationCache>({})
  const [isEnabled, setIsEnabled] = useState(true)

  // Функция для получения субтитров из YouTube
  const extractSubtitles = (): SubtitleLine[] => {
    const lines: SubtitleLine[] = []

    // Ищем элементы субтитров YouTube
    const segmentElements = document.querySelectorAll(
      "ytd-transcript-segment-renderer"
    )

    segmentElements.forEach((segment, index) => {
      const textElement = segment.querySelector(
        ".segment-text"
      ) as HTMLElement
      const timestampElement = segment.querySelector(
        ".segment-timestamp"
      ) as HTMLElement

      if (textElement && timestampElement) {
        lines.push({
          text: textElement.innerText.trim(),
          timestamp: parseFloat(timestampElement.getAttribute("aria-label") || "0"),
          translation: translationCache[textElement.innerText.trim()]
        })
      }
    })

    return lines
  }

  // Функция для перевода строки
  const translateLine = async (text: string, index: number) => {
    // Проверяем кэш
    if (translationCache[text]) {
      return
    }

    // Устанавливаем статус загрузки
    setSubtitles(prev => prev.map((line, i) =>
      i === index ? { ...line, isLoading: true } : line
    ))

    try {
      const response = await fetch(`${BACKEND_URL}/translate-line`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const translation = data.translation || data.text || "Translation unavailable"

      // Сохраняем в кэш
      setTranslationCache(prev => ({
        ...prev,
        [text]: translation
      }))

      // Обновляем субтитры
      setSubtitles(prev => prev.map((line, i) =>
        i === index
          ? { ...line, translation, isLoading: false }
          : line
      ))
    } catch (error) {
      console.error("Translation error:", error)
      setSubtitles(prev => prev.map((line, i) =>
        i === index
          ? { ...line, translation: "Error: Could not translate", isLoading: false }
          : line
      ))
    }
  }

  // Загрузка субтитров при монтировании
  useEffect(() => {
    const loadSubtitles = () => {
      const extracted = extractSubtitles()
      if (extracted.length > 0) {
        setSubtitles(extracted)
      }
    }

    // Начальная загрузка
    loadSubtitles()

    // Отслеживаем изменения в DOM (на случай динамической загрузки субтитров)
    const observer = new MutationObserver(() => {
      loadSubtitles()
    })

    const transcriptContainer = document.querySelector("ytd-transcript-renderer")
    if (transcriptContainer) {
      observer.observe(transcriptContainer, {
        childList: true,
        subtree: true
      })
    }

    return () => observer.disconnect()
  }, [])

  // Отслеживание активной строки субтитров YouTube
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const activeSegment = document.querySelector(
        "ytd-transcript-segment-renderer.style-scope.ytd-transcript-search-panel-renderer[active]"
      ) || document.querySelector(
        "ytd-transcript-segment-renderer[active]"
      )

      if (activeSegment) {
        const allSegments = Array.from(
          document.querySelectorAll("ytd-transcript-segment-renderer")
        )
        const index = allSegments.indexOf(activeSegment)

        if (index !== -1 && index !== activeIndex) {
          setActiveIndex(index)

          // Автоматически переводим активную строку, если включено
          if (isEnabled && subtitles[index] && !subtitles[index].translation) {
            translateLine(subtitles[index].text, index)
          }
        }
      }
    })

    const transcriptContainer = document.querySelector("ytd-transcript-renderer")
    if (transcriptContainer) {
      observer.observe(transcriptContainer, {
        attributes: true,
        attributeFilter: ["active"],
        subtree: true
      })
    }

    return () => observer.disconnect()
  }, [activeIndex, subtitles, isEnabled])

  const handleLineClick = (index: number) => {
    setActiveIndex(index)
    if (isEnabled && !subtitles[index].translation) {
      translateLine(subtitles[index].text, index)
    }
  }

  return (
    <div className="video-reader-panel">
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Video Reader
        </h3>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isEnabled
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-300 text-gray-700 hover:bg-gray-400"
          }`}
        >
          {isEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {/* Список субтитров */}
      {subtitles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No subtitles found. Open the YouTube transcript panel to see subtitles here.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {subtitles.map((line, index) => (
            <div
              key={index}
              onClick={() => handleLineClick(index)}
              className={`subtitle-line p-3 rounded-lg cursor-pointer border border-gray-200 ${
                index === activeIndex ? "active" : ""
              }`}
            >
              {/* Оригинальный текст */}
              <div className="text-sm text-gray-800 font-medium">
                {line.text}
              </div>

              {/* Перевод */}
              {line.isLoading && (
                <div className="mt-2 text-xs text-gray-500 italic">
                  Translating...
                </div>
              )}

              {line.translation && !line.isLoading && (
                <div className="mt-2 text-sm text-blue-700 border-t border-gray-200 pt-2">
                  {line.translation}
                </div>
              )}

              {/* Кнопка перевода для неактивных строк */}
              {!line.translation && !line.isLoading && index !== activeIndex && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    translateLine(line.text, index)
                  }}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-700 hover:underline"
                >
                  Translate
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Информация о статусе */}
      <div className="mt-4 pt-4 border-t border-gray-300">
        <p className="text-xs text-gray-600">
          Backend: {BACKEND_URL} |
          Subtitles: {subtitles.length} |
          Active: {activeIndex >= 0 ? activeIndex + 1 : "None"}
        </p>
      </div>
    </div>
  )
}

export default VideoReaderPanel
