import { redirect } from "next/navigation";

/**
 * Редирект со старого пути /sign-in на новый /auth/sign-in
 * Необходимо для обратной совместимости с существующими ссылками
 */
export default function SignInRedirect() {
  redirect("/auth/sign-in");
}
