export const metadata = {
  title: "Вход - Simple",
  description: "Страница входа",
};

import Image from "next/image";

export default function SignIn() {
  return (
    <div className="auth-container">
      <div className="auth-form">
        <header>Вход</header>

        <div className="auth-media-options">
          <div className="auth-field google">
            <a href="#" onClick={(e) => {
              e.preventDefault();
              // Здесь будет логика Google OAuth
              console.log('Google OAuth clicked');
            }}>
              <Image
                src="/images/google.svg"
                alt="Google"
                width={20}
                height={20}
              />
              <span>Войти через Google</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
