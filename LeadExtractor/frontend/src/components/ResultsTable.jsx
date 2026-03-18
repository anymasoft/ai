import { useState } from 'react'

export default function ResultsTable({ results, onEmailCopied }) {
  // Нормализовать данные: 1 email = 1 строка, 1 phone = 1 строка (БЕЗ связывания)
  const normalizeData = () => {
    const normalized = []

    results.forEach(result => {
      const website = result.website
      const emails = result.emails || []
      const phones = result.phones || []

      console.log(`[DEBUG] ResultsTable normalizing ${website}: ${emails.length} emails, ${phones.length} phones`)

      // ✅ PASS 1: Добавить ВСЕ emails (каждый email = отдельная строка)
      emails.forEach((email, emailIdx) => {
        normalized.push({
          website,
          email: email.email,
          emailSource: email.source_page,
          phone: null,  // ✅ НЕ связываем с phones!
          phoneSource: null,
        })
        console.log(`[DEBUG] Added email row: ${email.email}`)
      })

      // ✅ PASS 2: Добавить ВСЕ phones (каждый phone = отдельная строка)
      // ВСЕГДА добавляются, БЕЗ зависимости от emails!
      phones.forEach((phone, phoneIdx) => {
        normalized.push({
          website,
          email: null,  // ✅ НЕ связываем с emails!
          emailSource: null,
          phone: phone.phone,
          phoneSource: phone.source_page,
        })
        console.log(`[DEBUG] Added phone row: ${phone.phone}`)
      })
    })

    console.log(`[DEBUG] Final normalized rows: ${normalized.length}`)
    return normalized
  }

  const normalizedData = normalizeData()

  // DEBUG: Log before render
  console.log(`[DEBUG RENDER] normalizedData.length = ${normalizedData.length}`)
  console.log(`[DEBUG RENDER] First 20 rows:`)
  normalizedData.slice(0, 20).forEach((row, idx) => {
    console.log(`  [${idx}] website: ${row.website}, email: ${row.email}, phone: ${row.phone}`)
  })

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
