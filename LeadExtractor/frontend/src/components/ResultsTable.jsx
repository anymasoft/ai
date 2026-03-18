export default function ResultsTable({ results }) {
  // Вспомогательная функция для обрезки и форматирования URL
  const formatUrl = (urlString) => {
    try {
      const url = new URL(urlString)
      let path = url.pathname

      // Обрезаем до 40 символов и добавляем ... если длиннее
      if (path.length > 40) {
        path = path.substring(0, 40) + '...'
      }

      return path
    } catch (e) {
      return urlString
    }
  }

  // Фильтруем результаты: только те, у которых есть emails или phones
  const filteredResults = results.filter(
    result => (result.emails && result.emails.length > 0) || (result.phones && result.phones.length > 0)
  )

  return (
    <table>
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
        {filteredResults.map((result, idx) => {
          const emails = result.emails || []
          const phones = result.phones || []
          const sources = result.sources || []

          // Вычисляем максимальное количество строк ТОЛЬКО для результатов с данными
          const maxLen = Math.max(
            emails.length || 0,
            phones.length || 0,
            sources.length || 0,
            1  // Минимум 1 строка на результат
          )

          return Array.from({ length: maxLen }).map((_, i) => {
            const email = emails[i]
            const phone = phones[i]
            const source = sources[i]

            return (
              <tr key={`${idx}-${i}`}>
                <td className="font-semibold">{i === 0 ? result.website : ''}</td>

                {/* Email ячейка */}
                <td>
                  {email ? (
                    <>
                      <a
                        href={`mailto:${email.email}`}
                        className="text-blue-600 hover:underline break-all"
                        title={email.email}
                      >
                        {email.email}
                      </a>
                      {email.source_page && (
                        <div
                          className="text-xs text-gray-500 mt-1 break-all"
                          title={email.source_page}
                        >
                          {formatUrl(email.source_page)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Phone ячейка */}
                <td>
                  {phone ? (
                    <>
                      <a
                        href={`tel:${phone.phone.replace(/\s/g, '')}`}
                        className="text-blue-600 hover:underline break-all"
                        title={phone.phone}
                      >
                        {phone.phone}
                      </a>
                      {phone.source_page && (
                        <div
                          className="text-xs text-gray-500 mt-1 break-all"
                          title={phone.source_page}
                        >
                          {formatUrl(phone.source_page)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Source ячейка */}
                <td className="text-xs text-gray-600 break-all">
                  {source ? formatUrl(source) : '-'}
                </td>

                {/* Action ячейка */}
                <td>
                  {email?.email && (
                    <a
                      href={`mailto:${email.email}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Email
                    </a>
                  )}
                </td>
              </tr>
            )
          })
        })}

        {/* Сообщение если нет результатов */}
        {filteredResults.length === 0 && (
          <tr>
            <td colSpan="5" className="text-center text-gray-500 py-4">
              No contacts found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
