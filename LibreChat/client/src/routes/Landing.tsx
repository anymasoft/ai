import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TokenPackageDoc {
  packageId: string;
  label: string;
  priceRub: number;
  tokenCredits: number;
  isActive: boolean;
}

export default function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [packages, setPackages] = useState<TokenPackageDoc[]>([]);

  // ✅ Загружаем тарифы из API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/payment/plans');
        if (res.ok) {
          const data = await res.json();
          setPackages(data.tokenPackages ?? []);
        }
      } catch (err) {
        console.error('Ошибка загрузки тарифов:', err);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Fetch and render the landing page HTML
    fetch('/landwind/index.html')
      .then((res) => res.text())
      .then((html) => {
        // Modify HTML to use public paths
        let modifiedHTML = html
          .replace(/href="\.\/output\.css"/g, 'href="/landwind/output.css"')
          .replace(/src="\.\/images\//g, 'src="/landwind/images/')
          .replace(/href="\.\/apple-touch-icon\.png"/g, 'href="/landwind/apple-touch-icon.png"')
          .replace(/href="\.\/favicon-/g, 'href="/landwind/favicon-')
          .replace(/href="\.\/site\.webmanifest"/g, 'href="/landwind/site.webmanifest"')
          .replace(/src="\.\/([^/][^"]*\.png)"/g, 'src="/landwind/$1"');

        // ✅ ЗАМЕНА ДИНАМИЧЕСКИХ ТАРИФОВ
        // Ищем карточки тарифов по структуре HTML и заменяем значения
        if (packages.length > 0) {
          const priceRegex = /(<span class="mr-2 text-5xl font-extrabold">)\$?[\d,]+(<\/span>)/g;
          const prices = packages.map(p => `${p.priceRub}`);

          modifiedHTML = modifiedHTML.replace(priceRegex, (match, before, after, offset) => {
            const cardIndex = (modifiedHTML.substring(0, offset).match(/<span class="mr-2 text-5xl font-extrabold">/g) || []).length - 1;
            if (cardIndex >= 0 && cardIndex < prices.length) {
              return `${before}${prices[cardIndex]} ₽${after}`;
            }
            return match;
          });

          // Заменяем названия тарифов
          const nameRegex = /(<h3 class="mb-4 text-2xl font-semibold">)(Starter|Company|Enterprise)<\/h3>/g;
          let nameIndex = 0;
          modifiedHTML = modifiedHTML.replace(nameRegex, (match) => {
            if (nameIndex < packages.length) {
              return `<h3 class="mb-4 text-2xl font-semibold">${packages[nameIndex++].label}</h3>`;
            }
            return match;
          });
        }

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
  }, [navigate, packages]);

  return <div ref={containerRef} style={{ width: '100%', minHeight: '100vh' }} />;
}
