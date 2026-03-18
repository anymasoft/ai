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

  const handleExtract = async () => {
    setError('')
    setSuccess('')

    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      setError('Please enter at least one URL')
      return
    }

    setLoading(true)
    try {
      const data = await extractContacts(urlList)
      setResults(data.results)
      setSuccess(`Found contacts for ${data.results.filter(r => r.emails.length > 0 || r.phones.length > 0).length} sites`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to extract contacts')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateScore = (result) => {
    let score = 0
    if (result.emails && result.emails.length > 0) score += 30
    if (result.phones && result.phones.length > 0) score += 20
    if (result.sources && result.sources.some(s => s.toLowerCase().includes('contact'))) score += 20
    if (result.sources && result.sources.some(s => s.toLowerCase().includes('about'))) score += 10
    if (result.sources && result.sources.length > 2) score += 10
    return Math.min(score, 100)
  }

  const getStatus = (score) => {
    if (score >= 80) return 'HOT'
    if (score >= 50) return 'WARM'
    return 'COLD'
  }

  const handleExportCSV = () => {
    const headers = ['Website', 'Emails (Count)', 'Phones (Count)', 'Sources (Count)', 'Lead Score', 'Status', 'All Sources']
    const rows = []

    // Фильтруем результаты с контактами
    const filteredResults = results.filter(
      result => (result.emails?.length > 0) || (result.phones?.length > 0)
    )

    filteredResults.forEach(result => {
      const score = calculateScore(result)
      const status = getStatus(score)
      const emails = result.emails || []
      const phones = result.phones || []
      const sources = result.sources || []

      rows.push([
        result.website,
        emails.length,
        phones.length,
        sources.length,
        score,
        status,
        sources.join('; '),
      ])
    })

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`
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
