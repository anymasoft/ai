// Premium SVG Flags для YouTube Transcript Viewer
// Inline SVG флаги для обхода CSP ограничений Chrome Extension

const FLAGS_SVG = {
  ru: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 6"><path fill="#fff" d="M0 0h9v6H0z"/><path fill="#0039a6" d="M0 2h9v4H0z"/><path fill="#d52b1e" d="M0 4h9v2H0z"/></svg>`,

  en: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><clipPath id="a"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="b"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#a)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="m0 0 60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="m0 0 60 30m0-30L0 30" clip-path="url(#b)" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>`,

  es: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500"><path fill="#c60b1e" d="M0 0h750v500H0z"/><path fill="#ffc400" d="M0 125h750v250H0z"/></svg>`,

  de: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><path d="M0 0h5v3H0z"/><path fill="#D00" d="M0 1h5v2H0z"/><path fill="#FFCE00" d="M0 2h5v1H0z"/></svg>`,

  fr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><path fill="#ED2939" d="M0 0h900v600H0z"/><path fill="#fff" d="M0 0h600v600H0z"/><path fill="#002395" d="M0 0h300v600H0z"/></svg>`,

  ja: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><path fill="#fff" d="M0 0h900v600H0z"/><circle fill="#bc002d" cx="450" cy="300" r="180"/></svg>`,

  zh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><path fill="#de2910" d="M0 0h30v20H0z"/><path fill="#ffde00" d="m5 3 .9 2.8h2.9l-2.4 1.7.9 2.8-2.3-1.7-2.4 1.7.9-2.8-2.3-1.7H5zm5.4 7.7.4-.9.8.5-.3-.9.7-.5h-1l-.3-.9-.3.9h-.9l.7.5zm1.1-2-.3.9.7.5H11l.4.9.4-.9h.9l-.7-.5.3-.9-.8.5zm1.1 3.8.4-.9-.8-.5 1 0 .3-.9.3.9H14l-.7.5.3.9-.7-.5zm-4.1-.5-.3.9.7.5h-1l.4.9.4-.9h.9l-.7-.5.3-.9-.7.5z"/></svg>`,

  it: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><path fill="#009246" d="M0 0h3v2H0z"/><path fill="#fff" d="M1 0h2v2H1z"/><path fill="#ce2b37" d="M2 0h1v2H2z"/></svg>`,

  pt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><path fill="#060" d="M0 0h600v400H0z"/><path fill="#D52B1E" d="M0 0h240v400H0z"/><circle cx="240" cy="200" r="80" fill="#FAF20A"/><path fill="#D52B1E" d="M240 160a40 40 0 0 0 0 80 45 45 0 0 0 0-80z"/><circle cx="240" cy="200" r="30" fill="#fff"/></svg>`
};

// Функция для получения SVG флага
function getFlagSVG(countryCode) {
  return FLAGS_SVG[countryCode] || FLAGS_SVG.en;
}
