import { useState } from 'react'

export default function ResultsTable({ results, onEmailCopied }) {
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
          })
        })
      }
    })

    return normalized
  }

  const normalizedData = normalizeData()

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

  // Клик по email - копирует в буфер и показывает toast
  const handleEmailClick = (email) => {
    navigator.clipboard.writeText(email).then(() => {
      onEmailCopied(email)
    })
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
          </tr>
        </thead>
        <tbody>
          {normalizedData.length === 0 ? (
            <tr>
              <td colSpan="4" className="empty-state">
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
                </td>

                {/* Email Column */}
                <td className="contact-cell">
                  {row.email ? (
                    <span
                      className="email-text"
                      onClick={() => handleEmailClick(row.email)}
                      title={`Click to copy: ${row.email}`}
                    >
                      {row.email}
                    </span>
                  ) : (
                    <span className="empty-cell">-</span>
                  )}
                </td>

                {/* Phone Column */}
                <td className="contact-cell">
                  {row.phone ? (
                    <a
                      href={`tel:${row.phone.replace(/\s/g, '')}`}
                      className="phone-link"
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
