import { useState } from 'react'
import { extractContacts } from './api'
import ResultsTable from './components/ResultsTable'
import Header from './components/Header'

export default function App() {
  const [urls, setUrls] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })

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

      const contactCount = data.results.filter(r =>
        (r.emails && r.emails.length > 0) || (r.phones && r.phones.length > 0)
      ).length
      const emailCount = data.results.reduce((sum, r) => sum + (r.emails?.length || 0), 0)
      const phoneCount = data.results.reduce((sum, r) => sum + (r.phones?.length || 0), 0)

      setSuccess(`Found ${emailCount} emails and ${phoneCount} phones from ${contactCount} sites`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to extract contacts')
      console.error('Error:', err)
    } finally {
      setLoading(false)
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

        <div>
          <button onClick={handleExtract} disabled={loading}>
            {loading ? (
              <>
                <span className="loading"></span> Finding...
              </>
            ) : (
              'Find Contacts'
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

        {results.length > 0 && (
          <>
            <ResultsTable results={results} />
            <button onClick={handleExportCSV} style={{ marginTop: '20px' }}>
              Export CSV
            </button>
          </>
        )}
      </div>
    </>
  )
}
