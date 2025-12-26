export function Logos() {
  const technologies = [
    "TypeScript",
    "Supabase",
    "Stripe",
    "Tailwind CSS",
    "shadcn/ui",
    "Vitest",
    "PostgreSQL",
    "Prisma",
    "MSW",
    "Testing Library",
    "ESLint",
    "Prettier",
  ];

  return (
    <section className="py-12 text-center sm:px-4">
      <h2 className="text-center font-semibold text-muted-foreground text-sm">
        Построено с использованием современных технологий
      </h2>

      <div className="relative mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 max-w-5xl mx-auto">
          {technologies.map((tech) => (
            <div
              className="flex items-center justify-center px-4 py-3 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition"
              key={tech}
            >
              {tech}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
