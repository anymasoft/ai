import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Mock authentication: accept user@example.com / 111
    if (email === "user@example.com" && password === "111") {
      // Store token in localStorage for demo
      localStorage.setItem("auth_token", "demo_token_" + Date.now());
      navigate("/app/playground");
    } else {
      setError("Invalid credentials. Try: user@example.com / 111");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Sign In</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enter your credentials to access Screenshot to Code
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>

            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Demo credentials: <br />
            <code className="bg-muted px-2 py-1 rounded">user@example.com</code>
            <br />
            <code className="bg-muted px-2 py-1 rounded">111</code>
          </p>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/" className="text-primary hover:underline font-medium">
                Back to home
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
