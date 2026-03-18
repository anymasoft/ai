export default function ResultsTable({ results }) {
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
        {results.map((result, idx) => {
          const emails = result.emails || []
          const phones = result.phones || []
          const sources = result.sources || []

          const maxLen = Math.max(
            emails.length || 1,
            phones.length || 1,
            sources.length || 1
          )

          return Array.from({ length: maxLen }).map((_, i) => {
            const email = emails[i]
            const phone = phones[i]
            const source = sources[i]

            return (
              <tr key={`${idx}-${i}`}>
                <td>{i === 0 ? result.website : ''}</td>
                <td>
                  {email ? (
                    <>
                      {email.email}
                      {email.source_page && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new URL(email.source_page).pathname}
                        </div>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {phone ? (
                    <>
                      {phone.phone}
                      {phone.source_page && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new URL(phone.source_page).pathname}
                        </div>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{source ? new URL(source).pathname : '-'}</td>
                <td>
                  {email?.email && (
                    <a
                      href={`mailto:${email.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      Email
                    </a>
                  )}
                </td>
              </tr>
            )
          })
        })}
      </tbody>
    </table>
  )
}
