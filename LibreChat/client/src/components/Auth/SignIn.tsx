/**
 * Simplified Sign In Page
 * Содержит только одну кнопку "Войти через Яндекс"
 * Ведет на /oauth/yandex для прямой авторизации через Yandex OAuth
 *
 * Этот компонент обходит встроенную сложную страницу /login
 */

import React from 'react';

export const SignIn: React.FC = () => {
  const handleYandexLogin = () => {
    // Редирект на backend OAuth маршрут
    window.location.href = '/oauth/yandex';
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          background: 'white',
          padding: '48px 40px',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        {/* Заголовок */}
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: '28px',
            fontWeight: '600',
            color: '#1f2937',
          }}
        >
          Добро пожаловать
        </h1>

        {/* Описание */}
        <p
          style={{
            margin: '0 0 32px 0',
            fontSize: '14px',
            color: '#6b7280',
          }}
        >
          Входите через Яндекс для быстрой авторизации
        </p>

        {/* Yandex Logo */}
        <div style={{ marginBottom: '24px' }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ margin: '0 auto', color: '#000' }}
          >
            <path d="M9.5 1c-.83 0-1.5.67-1.5 1.5V8H6V5.5c0-.83-.67-1.5-1.5-1.5S3 4.67 3 5.5V8H2v2h1v7c0 .83.67 1.5 1.5 1.5S8 17.83 8 17V10h2v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7h2v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V10h3V8h-3V2.5c0-.83-.67-1.5-1.5-1.5S14 1.67 14 2.5v3h-1.5V2.5c0-.83-.67-1.5-1.5-1.5z" />
          </svg>
        </div>

        {/* Кнопка входа */}
        <button
          onClick={handleYandexLogin}
          style={{
            width: '100%',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '500',
            borderRadius: '8px',
            border: 'none',
            background: '#ffcc00',
            color: '#000',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(255, 204, 0, 0.3)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#ffb300';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 204, 0, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#ffcc00';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 204, 0, 0.3)';
          }}
        >
          Войти через Яндекс
        </button>

        {/* Footer */}
        <p
          style={{
            margin: '24px 0 0 0',
            fontSize: '12px',
            color: '#9ca3af',
          }}
        >
          Вы будете перенаправлены на Яндекс для безопасной авторизации
        </p>
      </div>
    </div>
  );
};

export default SignIn;
