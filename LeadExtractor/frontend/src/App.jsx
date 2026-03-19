import { useState } from 'react'
import { extractContacts, saveHtmlPages } from './api'
import ResultsTable from './components/ResultsTable'
import Header from './components/Header'

export default function App() {
  const [urls, setUrls] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [toastMessage, setToastMessage] = useState('')
  const [savingHtml, setSavingHtml] = useState(false)
  const [saveHtmlMessage, setSaveHtmlMessage] = useState('')

  // Показать toast
  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 1500)
  }

  // Когда email скопирован
  const handleEmailCopied = (email) => {
    showToast('Copied')
  }

  // Нормализовать данные для подсчета уникальных контактов
  const getNormalizedData = () => {
    const normalized = []
    results.forEach(result => {
      const emails = result.emails || []
      const phones = result.phones || []

      if (emails.length > 0) {
        emails.forEach((email, emailIdx) => {
          normalized.push({
            website: result.website,
            email: email.email,
            phone: phones.length > emailIdx ? phones[emailIdx].phone : null,
          })
        })
      }

      if (phones.length > 0 && emails.length === 0) {
        phones.forEach(phone => {
          normalized.push({
            website: result.website,
            email: null,
            phone: phone.phone,
          })
        })
      }
    })
    return normalized
  }

  const handleExtract = async () => {
    setError('')
    setSuccess('')
    setProgress({ current: 0, total: 0 })

    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      setError('Please enter at least one URL')
      return
    }

    setLoading(true)
    setProgress({ current: 0, total: urlList.length })

    try {
      // Simulate progress updates (in a real app, use WebSocket or SSE)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev.current < prev.total * 0.9) {
            return { ...prev, current: prev.current + 1 }
          }
          return prev
        })
      }, 500)

      const data = await extractContacts(urlList)
      clearInterval(progressInterval)

      setResults(data.results)
      setProgress({ current: urlList.length, total: urlList.length })

      // DEBUG: Log raw data from backend
      console.log('[DEBUG] Raw API response:')
      data.results.forEach((result, idx) => {
        console.log(`  [${idx}] ${result.website}: ${result.emails.length} emails, ${result.phones.length} phones`)
        console.log(`       Emails:`, result.emails)
        console.log(`       Phones:`, result.phones)
      })

      // ❌ НЕПРАВИЛЬНАЯ ЛОГИКА (СТАРАЯ) - ПОТЕРЯНЫ ТЕЛЕФОНЫ!
      // Причина: попытка связать emails и phones по индексу
      // И: phones добавляются ТОЛЬКО если нет emails
      // Результат: теряются 50% телефонов

      // ✅ ПРАВИЛЬНАЯ ЛОГИКА - РАЗДЕЛЬНО ВСЕ КОНТАКТЫ
      const normalized = []
      data.results.forEach(result => {
        const emails = result.emails || []
        const phones = result.phones || []

        // PASS 1: Добавить ВСЕ emails
        emails.forEach(email => {
          normalized.push({
            website: result.website,
            email: email.email,
            phone: null  // ❌ НЕ связываем с phones!
          })
        })

        // PASS 2: Добавить ВСЕ phones ОТДЕЛЬНО
        phones.forEach(phone => {
          normalized.push({
            website: result.website,
            email: null,  // ❌ НЕ связываем с emails!
            phone: phone.phone
          })
        })
      })

      console.log('[DEBUG] Normalized data:')
      console.log(`  Total rows: ${normalized.length}`)
      normalized.slice(0, 20).forEach((row, idx) => {
        console.log(`  [${idx}] email: ${row.email}, phone: ${row.phone}`)
      })

      const uniqueEmails = new Set(normalized.filter(r => r.email).map(r => r.email)).size
      const uniquePhones = new Set(normalized.filter(r => r.phone).map(r => r.phone)).size
      const sitesWithContacts = new Set(normalized.map(r => r.website)).size

      console.log(`[DEBUG] COUNTS: ${uniqueEmails} emails, ${uniquePhones} phones from ${sitesWithContacts} sites`)
      setSuccess(`Found ${uniqueEmails} emails and ${uniquePhones} phones from ${sitesWithContacts} sites`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to extract contacts')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHtml = async () => {
    setSaveHtmlMessage('')
    setError('')

    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      setError('Please enter at least one URL to save HTML from')
      return
    }

    setSavingHtml(true)

    try {
      const data = await saveHtmlPages(urlList)

      if (data.results && data.results.length > 0) {
        const firstResult = data.results[0]
        const pagesCount = firstResult.saved_pages
        const folder = firstResult.folder
        setSaveHtmlMessage(`✓ Saved ${pagesCount} HTML pages to:\n${folder}`)
        showToast(`Saved ${pagesCount} pages`)
      } else {
        setSaveHtmlMessage('No pages were saved')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save HTML pages')
      console.error('Error saving HTML:', err)
    } finally {
      setSavingHtml(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Website', 'Email', 'Phone', 'Source']
    const rows = []

    // Нормализуем данные также как в ResultsTable
    results.forEach(result => {
      const website = result.website
      const emails = result.emails || []
      const phones = result.phones || []

      if (emails.length > 0) {
        emails.forEach((email, emailIdx) => {
          const phone = phones.length > emailIdx ? phones[emailIdx].phone : ''
          const source = email.source_page || ''
          rows.push([website, email.email, phone, source])
        })
      }

      // Если есть phones без emails
      if (phones.length > 0 && emails.length === 0) {
        phones.forEach(phone => {
          rows.push([website, '', phone.phone, phone.source_page || ''])
        })
      }
    })

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header />
      <div className="container">
        <h1 className="text-4xl font-bold mb-2">Find Contacts from Company Websites</h1>
        <p className="text-gray-600 mb-6">Paste company websites below</p>

        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="example.com&#10;startup.io&#10;company.org"
          disabled={loading}
        />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExtract} disabled={loading}>
            {loading ? (
              <>
                <span className="loading"></span> Finding...
              </>
            ) : (
              'Find Contacts'
            )}
          </button>
          <button onClick={handleSaveHtml} disabled={savingHtml} style={{ backgroundColor: '#10b981' }}>
            {savingHtml ? (
              <>
                <span className="loading"></span> Saving...
              </>
            ) : (
              '📥 Save Crawled HTML'
            )}
          </button>
        </div>

        {loading && progress.total > 0 && (
          <div className="progress-container">
            <div className="progress-text">
              Processing {progress.current} / {progress.total} URLs...
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        {saveHtmlMessage && (
          <div className="success" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {saveHtmlMessage}
          </div>
        )}

        {results.length > 0 && (
          <>
            {console.log(`[DEBUG APP] About to render ResultsTable with results.length = ${results.length}`)}
            {results.forEach((result, idx) => {
              console.log(`  [${idx}] website: ${result.website}, emails: ${result.emails?.length || 0}, phones: ${result.phones?.length || 0}`)
            })}
            <ResultsTable results={results} onEmailCopied={handleEmailCopied} />
            <button onClick={handleExportCSV} style={{ marginTop: '20px' }}>
              Export CSV
            </button>
          </>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="toast-notification">
            {toastMessage}
          </div>
        )}
      </div>
    </>
  )
}
