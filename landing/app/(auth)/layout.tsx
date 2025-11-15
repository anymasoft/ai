import Logo from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="relative flex grow">
        {children}
      </main>
    </>
  );
}
