import React from 'react';

export default function Header() {
  return (
    <header className="fixed top-2 z-30 w-full md:top-6">
      <div className="container-custom">
        <div className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-black/[0.03] backdrop-blur-sm border border-gray-200/80">
          {/* Site branding */}
          <div className="flex flex-1 items-center">
            <a href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow-md">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Video Reader AI
              </span>
            </a>
          </div>

          {/* Desktop sign in links */}
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="hidden sm:flex px-4 py-2 border gap-2 border-gray-200 rounded-lg text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:shadow transition duration-150"
            >
              <img className="w-5 h-5" src="https://www.svgrepo.com/show/475656/google-color.svg" loading="lazy" alt="google logo" />
              <span className="text-sm font-medium">Login with Google</span>
            </a>
            <a
              href="#"
              className="btn btn-primary btn-sm"
            >
              Установить расширение
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
