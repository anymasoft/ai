import {
  Code,
  Database,
  CreditCard,
  Zap,
  Box,
  TestTubes,
  GitBranch,
  FileText,
} from "lucide-react";

export function Logos() {
  const technologies = [
    { name: "TypeScript", icon: Code },
    { name: "Supabase", icon: Database },
    { name: "Stripe", icon: CreditCard },
    { name: "Tailwind CSS", icon: Zap },
    { name: "shadcn/ui", icon: Box },
    { name: "Vitest", icon: TestTubes },
    { name: "PostgreSQL", icon: Database },
    { name: "Prisma", icon: Box },
    { name: "MSW", icon: GitBranch },
    { name: "Testing Library", icon: TestTubes },
    { name: "ESLint", icon: FileText },
    { name: "Prettier", icon: FileText },
  ];

  return (
    <section className="py-12 text-center sm:px-4">
      <h2 className="text-center font-semibold text-muted-foreground text-sm">
        Построено с использованием современных технологий
      </h2>

      <div className="relative mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 max-w-5xl mx-auto">
          {technologies.map(({ name, icon: Icon }) => (
            <div
              className="flex flex-col items-center justify-center px-4 py-4 rounded-lg border border-border hover:border-primary transition group"
              key={name}
            >
              <Icon className="size-6 text-muted-foreground group-hover:text-primary mb-2 transition" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
