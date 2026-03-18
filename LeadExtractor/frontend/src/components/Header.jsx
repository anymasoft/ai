export default function Header() {
  return (
    <header>
      <div className="logo">LeadExtractor</div>
      <div className="flex gap-4 text-sm">
        <a href="#" className="text-gray-700 hover:text-gray-900">Dashboard</a>
        <a href="#" className="text-gray-700 hover:text-gray-900">Export CSV</a>
        <a href="#" className="text-gray-700 hover:text-gray-900">Account</a>
      </div>
    </header>
  )
}
