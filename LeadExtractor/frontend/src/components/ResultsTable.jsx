import { useState } from 'react'

export default function ResultsTable({ results }) {
  const [copiedEmail, setCopiedEmail] = useState(null)

  // Нормализовать данные: 1 email = 1 строка
  const normalizeData = () => {
    const normalized = []

    results.forEach(result => {
      const website = result.website
      const emails = result.emails || []
      const phones = result.phones || []

      // Если есть emails - создаём по строке на каждый email
      if (emails.length > 0) {
        emails.forEach((email, emailIdx) => {
          normalized.push({
            website,
            email: email.email,
            emailSource: email.source_page,
            phone: phones.length > emailIdx ? phones[emailIdx].phone : null,
            phoneSource: phones.length > emailIdx ? phones[emailIdx].source_page : null,
            status: result.status_per_site?.[website],
          })
        })
      }

      // Если есть phones БЕЗ emails - добавляем их отдельными строками
      if (phones.length > 0 && emails.length === 0) {
        phones.forEach(phone => {
          normalized.push({
            website,
            email: null,
            emailSource: null,
            phone: phone.phone,
            phoneSource: phone.source_page,
            status: result.status_per_site?.[website],
          })
        })
      }
    })

    return normalized
  }

  const normalizedData = normalizeData()

  // Копировать email в буфер обмена
  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(email)
      setTimeout(() => setCopiedEmail(null), 2000)
    })
  }

  // Форматирование URL
  const formatUrl = (urlString) => {
    try {
      const url = new URL(urlString)
      let path = url.pathname
      if (path.length > 40) {
        path = path.substring(0, 40) + '...'
      }
      return path || '/'
    } catch (e) {
      return urlString
    }
  }

  return (
    <div className="results-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Website</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Source</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {normalizedData.length === 0 ? (
            <tr>
              <td colSpan="5" className="empty-state">
                No contacts found
              </td>
            </tr>
          ) : (
            normalizedData.map((row, idx) => (
              <tr key={idx} className="data-row">
                {/* Website Column */}
                <td className="website-cell">
                  <a
                    href={row.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="website-link"
                    title={row.website}
                  >
                    {row.website}
                  </a>
                  {row.status === 'fallback_success' && (
                    <span className="status-badge fallback">fallback</span>
                  )}
                </td>

                {/* Email Column */}
                <td className="contact-cell">
                  {row.email ? (
                    <div>
                      <a
                        href={`mailto:${row.email}`}
                        className="contact-link"
                        title={row.email}
                      >
                        {row.email}
                      </a>
                      <div className="copy-hint">
                        <button
                          className={`copy-button ${copiedEmail === row.email ? 'copied' : ''}`}
                          onClick={() => handleCopyEmail(row.email)}
                          title="Copy email"
                        >
                          {copiedEmail === row.email ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="empty-cell">-</span>
                  )}
                </td>

                {/* Phone Column */}
                <td className="contact-cell">
                  {row.phone ? (
                    <a
                      href={`tel:${row.phone.replace(/\s/g, '')}`}
                      className="contact-link"
                      title={row.phone}
                    >
                      {row.phone}
                    </a>
                  ) : (
                    <span className="empty-cell">-</span>
                  )}
                </td>

                {/* Source Column */}
                <td className="source-cell">
                  {row.emailSource ? (
                    <div className="source-text" title={row.emailSource}>
                      {formatUrl(row.emailSource)}
                    </div>
                  ) : row.phoneSource ? (
                    <div className="source-text" title={row.phoneSource}>
                      {formatUrl(row.phoneSource)}
                    </div>
                  ) : (
                    <span className="empty-cell">-</span>
                  )}
                </td>

                {/* Action Column */}
                <td className="action-cell">
                  {row.email ? (
                    <a
                      href={`mailto:${row.email}?subject=Inquiry&body=Hello`}
                      className="btn-email"
                      title={`Send email to ${row.email}`}
                    >
                      ✉️ Email
                    </a>
                  ) : (
                    <span className="empty-cell">-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
