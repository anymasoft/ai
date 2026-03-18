import { useState } from 'react'

export default function ResultsTable({ results }) {
  const [copiedSource, setCopiedSource] = useState(null)

  // Форматирование URL
  const formatUrl = (urlString) => {
    try {
      const url = new URL(urlString)
      let path = url.pathname
      if (path.length > 35) {
        path = path.substring(0, 35) + '...'
      }
      return path
    } catch (e) {
      return urlString
    }
  }

  // Копирование Source в буфер обмена при клике
  const handleSourceClick = (source, idx) => {
    navigator.clipboard.writeText(source).then(() => {
      setCopiedSource(idx)
      setTimeout(() => setCopiedSource(null), 2000)
    })
  }

  // Получить статус сайта (если есть)
  const getWebsiteStatus = (website) => {
    if (!results[0]?.status_per_site) return null
    return results[0].status_per_site[website] || null
  }

  return (
    <div className="results-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Website</th>
            <th>Emails</th>
            <th>Phones</th>
            <th>Sources</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td colSpan="5" className="empty-state">
                No data found
              </td>
            </tr>
          ) : (
            results.map((result, idx) => {
              const emails = result.emails || []
              const phones = result.phones || []
              const website = result.website
              const siteStatus = result.status_per_site?.[website]

              // Убираем дубли Sources используя Set
              const uniqueSources = [...new Set(result.sources || [])]

              // Если сайт заблокирован - показать специальную строку
              if (siteStatus === 'blocked' && emails.length === 0 && phones.length === 0) {
                return (
                  <tr key={idx} className="data-row blocked-row">
                    <td colSpan="5" className="blocked-message">
                      <span className="warning-icon">!</span> Site protected or blocked by anti-bot.
                      Try another website.
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="blocked-link"
                      >
                        {website}
                      </a>
                    </td>
                  </tr>
                )
              }

              // Если нет контактов (не заблокирован)
              if (emails.length === 0 && phones.length === 0) {
                return null
              }

              return (
                <tr key={idx} className="data-row">
                  {/* Website Column */}
                  <td className="website-cell">
                    <div className="website-wrapper">
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="website-link"
                        title={website}
                      >
                        {website}
                      </a>
                      {siteStatus === 'fallback_success' && (
                        <span className="status-badge fallback">fallback</span>
                      )}
                    </div>
                  </td>

                  {/* Emails Column */}
                  <td className="contacts-cell">
                    {emails.length > 0 ? (
                      <div className="contact-list">
                        {emails.map((email, i) => (
                          <div key={i} className="contact-item">
                            <a
                              href={`mailto:${email.email}`}
                              className="contact-link"
                              title={email.email}
                            >
                              {email.email}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="empty-cell">-</span>
                    )}
                  </td>

                  {/* Phones Column */}
                  <td className="contacts-cell">
                    {phones.length > 0 ? (
                      <div className="contact-list">
                        {phones.map((phone, i) => (
                          <div key={i} className="contact-item">
                            <a
                              href={`tel:${phone.phone.replace(/\s/g, '')}`}
                              className="contact-link"
                              title={phone.phone}
                            >
                              {phone.phone}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="empty-cell">-</span>
                    )}
                  </td>

                  {/* Sources Column (Уникальные значения) */}
                  <td className="sources-cell">
                    {uniqueSources.length > 0 ? (
                      <div className="sources-list">
                        {uniqueSources.map((source, i) => (
                          <div
                            key={i}
                            className={`source-item ${copiedSource === `${idx}-${i}` ? 'copied' : ''}`}
                            onClick={() => handleSourceClick(source, `${idx}-${i}`)}
                            title={`Click to copy: ${source}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                handleSourceClick(source, `${idx}-${i}`)
                              }
                            }}
                          >
                            {formatUrl(source)}
                            {copiedSource === `${idx}-${i}` && (
                              <span className="copy-indicator">Copied</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="empty-cell">-</span>
                    )}
                  </td>

                  {/* Action Column */}
                  <td className="action-cell">
                    {emails.length > 0 && (
                      <a
                        href={`mailto:${emails[0].email}?subject=Inquiry&body=Hello`}
                        className="btn-email"
                        title={`Send email to ${emails[0].email}`}
                      >
                        Email
                      </a>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
