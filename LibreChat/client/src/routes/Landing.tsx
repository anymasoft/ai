import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Fetch and render the landing page HTML
    fetch('/landwind/index.html')
      .then((res) => res.text())
      .then((html) => {
        // Modify HTML to use public paths
        const modifiedHTML = html
          .replace(/href="\.\/output\.css"/g, 'href="/landwind/output.css"')
          .replace(/src="\.\/images\//g, 'src="/landwind/images/')
          .replace(/href="\.\/apple-touch-icon\.png"/g, 'href="/landwind/apple-touch-icon.png"')
          .replace(/href="\.\/favicon-/g, 'href="/landwind/favicon-')
          .replace(/href="\.\/site\.webmanifest"/g, 'href="/landwind/site.webmanifest"')
          .replace(/src="\.\/([^/][^"]*\.png)"/g, 'src="/landwind/$1"');

        if (containerRef.current) {
          containerRef.current.innerHTML = modifiedHTML;

          // Handle CTA button clicks - redirect to /c/new
          const buttons = containerRef.current.querySelectorAll('a[href="#"]');
          buttons.forEach((btn) => {
            const text = btn.textContent?.toLowerCase() || '';
            if (
              text.includes('get started') ||
              text.includes('download') ||
              text.includes('try') ||
              text.includes('start') ||
              text.includes('open') ||
              text.includes('chat')
            ) {
              btn.addEventListener('click', (e) => {
                e.preventDefault();
                navigate('/c/new');
              });
            }
          });
        }
      })
      .catch((err) => console.error('Failed to load landing page:', err));
  }, [navigate]);

  return <div ref={containerRef} style={{ width: '100%', minHeight: '100vh' }} />;
}
