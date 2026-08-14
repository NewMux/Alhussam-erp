import { supabase } from "@/lib/supabase";
import { Loader2, Scissors } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthGate() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          // Email confirmation is required before the account can sign in.
          setNotice("Check your email to confirm your account, then sign in below.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <Scissors className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-5 text-center text-2xl font-semibold">
          {mode === "login" ? "Sign in to Al-Mamlaka ERP" : "Create your account"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "login"
            ? "Use the email and password set up for your staff account."
            : "The first account registered with the shop owner's email becomes the administrator."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="space-y-1.5 text-left">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                minLength={2}
                maxLength={160}
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1.5 text-left">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              maxLength={320}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5 text-left">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={200}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {notice && <p className="text-sm text-emerald-600">{notice}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
