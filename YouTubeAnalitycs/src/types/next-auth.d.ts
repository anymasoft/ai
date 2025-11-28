import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: "user" | "admin";
    plan: "free" | "pro";
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "user" | "admin";
      plan: "free" | "pro";
    };
  }
}
