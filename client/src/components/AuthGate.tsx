import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { Loader2, Scissors } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthGate() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSuccess = () => {
    setError(null);
    utils.auth.me.invalidate();
  };

  const onError = (err: unknown) => {
    setError(
      err instanceof TRPCClientError ? err.message : "Something went wrong. Please try again."
    );
  };

  const loginMutation = trpc.auth.login.useMutation({ onSuccess, onError });
  const registerMutation = trpc.auth.register.useMutation({ onSuccess, onError });

  const pending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ name, email, password });
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
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
