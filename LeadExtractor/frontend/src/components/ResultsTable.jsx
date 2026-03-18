export default function ResultsTable({ results }) {
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

  // Вычисление Lead Score
  const calculateScore = (result) => {
    let score = 0

    // +30 если есть email
    if (result.emails && result.emails.length > 0) {
      score += 30
    }

    // +20 если есть phone
    if (result.phones && result.phones.length > 0) {
      score += 20
    }

    // +20 если есть source содержащий "contact"
    if (
      result.sources &&
      result.sources.some(s => s.toLowerCase().includes('contact'))
    ) {
      score += 20
    }

    // +10 если есть "about"
    if (
      result.sources &&
      result.sources.some(s => s.toLowerCase().includes('about'))
    ) {
      score += 10
    }

    // +10 если pages > 2
    if (result.sources && result.sources.length > 2) {
      score += 10
    }

    return Math.min(score, 100) // Максимум 100
  }

  // Цвет для Score
  const getScoreBadgeClass = (score) => {
    if (score >= 80) return 'badge-green'
    if (score >= 50) return 'badge-yellow'
    return 'badge-gray'
  }

  // Текст статуса
  const getStatus = (score) => {
    if (score >= 80) return 'HOT'
    if (score >= 50) return 'WARM'
    return 'COLD'
  }

  // Фильтруем результаты: только с контактами
  const filteredResults = results.filter(
    result => (result.emails?.length > 0) || (result.phones?.length > 0)
  )

  return (
    <div className="results-container">
      <table className="lead-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Emails</th>
            <th>Phones</th>
            <th>Sources</th>
            <th>Score</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredResults.map((result, idx) => {
            const emails = result.emails || []
            const phones = result.phones || []
            const sources = result.sources || []
            const score = calculateScore(result)
            const status = getStatus(score)
            const badgeClass = getScoreBadgeClass(score)

            return (
              <tr key={idx} className="lead-row">
                {/* Company Column */}
                <td className="company-cell">
                  <a
                    href={result.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="company-link"
                    title={result.website}
                  >
                    {result.website}
                  </a>
                </td>

                {/* Emails Column */}
                <td className="contacts-cell">
                  {emails.length > 0 ? (
                    <div className="contact-list">
                      {emails.map((email, i) => (
                        <div key={i} className="contact-item">
                          <a
                            href={`mailto:${email.email}`}
                            className="contact-email"
                            title={email.email}
                          >
                            {email.email}
                          </a>
                          {email.source_page && (
                            <div className="source-hint">
                              {formatUrl(email.source_page)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
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
                            className="contact-phone"
                            title={phone.phone}
                          >
                            {phone.phone}
                          </a>
                          {phone.source_page && (
                            <div className="source-hint">
                              {formatUrl(phone.source_page)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Sources Column */}
                <td className="sources-cell">
                  {sources.length > 0 ? (
                    <div className="sources-list">
                      {sources.slice(0, 3).map((source, i) => (
                        <div key={i} className="source-tag">
                          {formatUrl(source)}
                        </div>
                      ))}
                      {sources.length > 3 && (
                        <div className="source-tag more">
                          +{sources.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Score Column */}
                <td className="score-cell">
                  <div className={`score-badge ${badgeClass}`}>{score}</div>
                </td>

                {/* Status Column */}
                <td className="status-cell">
                  <span className={`status-tag status-${status.toLowerCase()}`}>
                    {status}
                  </span>
                </td>

                {/* Action Column */}
                <td className="action-cell">
                  {emails.length > 0 && (
                    <a
                      href={`mailto:${emails[0].email}?subject=Partnership%20Inquiry&body=Hi,%0A%0AI found your website and would like to discuss a potential partnership.%0A%0ABest regards`}
                      className="btn-send-email"
                      title={`Send email to ${emails[0].email}`}
                    >
                      ✉️ Email
                    </a>
                  )}
                </td>
              </tr>
            )
          })}

          {/* Empty State */}
          {filteredResults.length === 0 && (
            <tr>
              <td colSpan="7" className="empty-state">
                No leads found. Extract contacts to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
