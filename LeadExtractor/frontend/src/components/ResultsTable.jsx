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
          const maxLen = Math.max(
            result.emails.length || 1,
            result.phones.length || 1,
            result.sources.length || 1
          )

          return Array.from({ length: maxLen }).map((_, i) => (
            <tr key={`${idx}-${i}`}>
              <td>{i === 0 ? result.website : ''}</td>
              <td>{result.emails[i] || '-'}</td>
              <td>{result.phones[i] || '-'}</td>
              <td>{result.sources[i] ? new URL(result.sources[i]).pathname : '-'}</td>
              <td>
                {result.emails[i] && (
                  <a
                    href={`mailto:${result.emails[i]}`}
                    className="text-blue-600 hover:underline"
                  >
                    Email
                  </a>
                )}
              </td>
            </tr>
          ))
        })}
      </tbody>
    </table>
  )
}
