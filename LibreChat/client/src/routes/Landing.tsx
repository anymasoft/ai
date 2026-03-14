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
  const [loading, setLoading] = useState(true);

  // ✅ Загружаем тарифы из БД (админ их там сохранил)
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
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!containerRef.current || loading) return;

    // Загружаем и рендерим static HTML для остальной части лендинга
    fetch('/landwind/index.html')
      .then((res) => res.text())
      .then((html) => {
        // Заменяем пути на public
        let modifiedHTML = html
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

          // ✅ ПРОСТО ЗАМЕНЯЕМ ТЕКСТ через DOM (без regex!)
          // Находим все спаны с ценами и подставляем данные из БД
          const priceSpans = containerRef.current.querySelectorAll('span.mr-2.text-5xl.font-extrabold');
          priceSpans.forEach((span, index) => {
            if (index < packages.length) {
              span.textContent = `${packages[index].priceRub} ₽`;
            }
          });

          // Находим все заголовки тарифов и подставляем данные из БД
          const titleElements = containerRef.current.querySelectorAll('h3.mb-4.text-2xl.font-semibold');
          titleElements.forEach((title, index) => {
            if (index < packages.length) {
              title.textContent = packages[index].label;
            }
          });
        }
      })
      .catch((err) => console.error('Failed to load landing page:', err));
  }, [navigate, packages, loading]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', minHeight: '100vh' }} />;
}
