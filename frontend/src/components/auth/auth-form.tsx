"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// --------------------------------
// Types and schemas
// --------------------------------

type AuthView =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "check-email"
  | "reset-password";

interface CheckEmailCopy {
  title: string;
  body: string;
}

const EMPTY_FIELD = "border-destructive";

const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.boolean().refine((agreed) => agreed, "You must agree to the terms"),
});

const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignInFormValues = z.infer<typeof signInSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// --------------------------------
// Shared helpers
// --------------------------------

function useAuthClient() {
  // `createClient()` returns the same browser client every render, and `null`
  // when the public Supabase values are missing from the environment.
  return React.useMemo(() => createClient(), []);
}

function useCompleteAuth(next: string) {
  const router = useRouter();
  return React.useCallback(() => {
    router.push(next);
    router.refresh();
  }, [router, next]);
}

function missingConfigMessage(): string {
  return "Authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to frontend/.env.local and restart the dev server.";
}

function separator(origin: string, next: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

// --------------------------------
// Local primitives (shadcn-shaped, no extra dependencies)
// --------------------------------

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium leading-none text-foreground", className)}
      {...props}
    />
  );
}

function Separator({ className }: { className?: string }) {
  return (
    <div role="presentation" className={cn("h-px w-full bg-border", className)} />
  );
}

function Checkbox({
  id,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-primary transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked && "bg-primary text-primary-foreground",
      )}
    >
      {checked ? <Check className="size-3" aria-hidden /> : null}
    </button>
  );
}

// --------------------------------
// Main auth component
// --------------------------------

export function Auth({
  className,
  initialView = "sign-in",
  initialError = null,
  next = "/",
  ...props
}: React.ComponentProps<"div"> & {
  initialView?: AuthView;
  initialError?: string | null;
  next?: string;
}) {
  const [view, setView] = React.useState<AuthView>(initialView);
  const [checkEmail, setCheckEmail] = React.useState<CheckEmailCopy>({
    title: "Check your email",
    body: "We sent a password reset link to your email.",
  });

  const showCheckEmail = React.useCallback((copy: CheckEmailCopy) => {
    setCheckEmail(copy);
    setView("check-email");
  }, []);

  return (
    <div
      data-slot="auth"
      className={cn("mx-auto w-full max-w-md", className)}
      {...props}
    >
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {view === "sign-in" && (
              <AuthSignIn
                key="sign-in"
                next={next}
                initialError={initialError}
                onForgotPassword={() => setView("forgot-password")}
                onSignUp={() => setView("sign-up")}
              />
            )}
            {view === "sign-up" && (
              <AuthSignUp
                key="sign-up"
                next={next}
                onSignIn={() => setView("sign-in")}
                onCheckEmail={showCheckEmail}
              />
            )}
            {view === "forgot-password" && (
              <AuthForgotPassword
                key="forgot-password"
                onSignIn={() => setView("sign-in")}
                onCheckEmail={showCheckEmail}
              />
            )}
            {view === "check-email" && (
              <AuthCheckEmail
                key="check-email"
                copy={checkEmail}
                onSignIn={() => setView("sign-in")}
              />
            )}
            {view === "reset-password" && (
              <AuthResetPassword key="reset-password" next={next} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// --------------------------------
// Shared pieces
// --------------------------------

interface AuthFormProps {
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
  className?: string;
}

function AuthForm({ onSubmit, children, className }: AuthFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      data-slot="auth-form"
      className={cn("space-y-6", className)}
    >
      {children}
    </form>
  );
}

function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      data-slot="auth-error"
      className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

function AuthSeparator({ text = "Or continue with" }: { text?: string }) {
  return (
    <div data-slot="auth-separator" className="relative mt-6">
      <div className="absolute inset-0 flex items-center">
        <Separator />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  );
}

function AuthSocialButtons({
  isLoading,
  next,
  onError,
}: {
  isLoading: boolean;
  next: string;
  onError: (message: string | null) => void;
}) {
  const supabase = useAuthClient();

  const signInWithGoogle = async () => {
    onError(null);
    if (!supabase) {
      onError(missingConfigMessage());
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: separator(window.location.origin, next) },
    });
    if (error) onError(error.message);
  };

  return (
    <div data-slot="auth-social-buttons" className="mt-6 w-full">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-lg bg-background/50"
        disabled={isLoading}
        onClick={signInWithGoogle}
      >
        <GoogleIcon />
        Google
      </Button>
    </div>
  );
}

// --------------------------------
// Sign in
// --------------------------------

interface AuthSignInProps {
  next: string;
  initialError?: string | null;
  onForgotPassword: () => void;
  onSignUp: () => void;
}

function AuthSignIn({
  next,
  initialError = null,
  onForgotPassword,
  onSignUp,
}: AuthSignInProps) {
  const supabase = useAuthClient();
  const complete = useCompleteAuth(next);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setError(missingConfigMessage());
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes("not confirmed")
            ? "Confirm your email address first — check your inbox for the link."
            : signInError.message,
        );
        return;
      }
      complete();
    } catch {
      setError("An unexpected error occurred. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      data-slot="auth-sign-in"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="p-8"
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      <AuthError message={error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            disabled={isLoading}
            className={cn("h-11 rounded-lg bg-background text-sm", errors.email && EMPTY_FIELD)}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs"
              disabled={isLoading}
              onClick={onForgotPassword}
            >
              Forgot password?
            </Button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              className={cn(
                "h-11 rounded-lg bg-background pr-11 text-sm",
                errors.password && EMPTY_FIELD,
              )}
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-0 h-full rounded-lg"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </Button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-lg text-[0.95rem]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </AuthForm>

      <AuthSeparator />
      <AuthSocialButtons isLoading={isLoading} next={next} onError={setError} />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          disabled={isLoading}
          onClick={onSignUp}
        >
          Create one
        </Button>
      </p>
    </motion.div>
  );
}

// --------------------------------
// Sign up
// --------------------------------

interface AuthSignUpProps {
  next: string;
  onSignIn: () => void;
  onCheckEmail: (copy: CheckEmailCopy) => void;
}

function AuthSignUp({ next, onSignIn, onCheckEmail }: AuthSignUpProps) {
  const supabase = useAuthClient();
  const complete = useCompleteAuth(next);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", terms: false },
  });

  const terms = useWatch({ control, name: "terms" }) ?? false;

  const onSubmit = async (values: SignUpFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setError(missingConfigMessage());
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.name },
          emailRedirectTo: separator(window.location.origin, next),
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!data.session) {
        onCheckEmail({
          title: "Confirm your email",
          body: `We sent a confirmation link to ${values.email}. Open it to activate your account, then sign in here.`,
        });
        return;
      }
      complete();
    } catch {
      setError("An unexpected error occurred. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      data-slot="auth-sign-up"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="p-8"
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Get started with your account</p>
      </div>

      <AuthError message={error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            autoComplete="name"
            disabled={isLoading}
            className={cn("h-11 rounded-lg bg-background text-sm", errors.name && EMPTY_FIELD)}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            disabled={isLoading}
            className={cn("h-11 rounded-lg bg-background text-sm", errors.email && EMPTY_FIELD)}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              className={cn(
                "h-11 rounded-lg bg-background pr-11 text-sm",
                errors.password && EMPTY_FIELD,
              )}
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-0 h-full rounded-lg"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </Button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={terms}
            disabled={isLoading}
            onCheckedChange={(checked) => setValue("terms", checked, { shouldValidate: true })}
          />
          <div className="space-y-1">
            <Label htmlFor="terms" className="text-sm">
              I agree to the terms
            </Label>
            <p className="text-xs text-muted-foreground">
              By signing up, you agree to our{" "}
              <Link
                href="/legal/terms-and-conditions"
                className="text-primary underline-offset-4 hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/privacy-policy"
                className="text-primary underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        {errors.terms ? (
          <p className="text-xs text-destructive">{errors.terms.message}</p>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-lg text-[0.95rem]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </AuthForm>

      <AuthSeparator />
      <AuthSocialButtons isLoading={isLoading} next={next} onError={setError} />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Have an account?{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          disabled={isLoading}
          onClick={onSignIn}
        >
          Sign in
        </Button>
      </p>
    </motion.div>
  );
}

// --------------------------------
// Forgot password
// --------------------------------

interface AuthForgotPasswordProps {
  onSignIn: () => void;
  onCheckEmail: (copy: CheckEmailCopy) => void;
}

function AuthForgotPassword({ onSignIn, onCheckEmail }: AuthForgotPasswordProps) {
  const supabase = useAuthClient();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setError(missingConfigMessage());
        return;
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        values.email,
        {
          // The recovery link comes back through /auth/callback, which exchanges
          // the code for a session and then opens the reset-password view.
          redirectTo: separator(window.location.origin, "/login?view=reset-password"),
        },
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      onCheckEmail({
        title: "Check your email",
        body: `We sent a password reset link to ${values.email}. Open it to choose a new password.`,
      });
    } catch {
      setError("An unexpected error occurred. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      data-slot="auth-forgot-password"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative p-8"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute left-4 top-4 rounded-lg"
        disabled={isLoading}
        onClick={onSignIn}
      >
        <ArrowLeft className="size-4" aria-hidden />
        <span className="sr-only">Back</span>
      </Button>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email to receive a reset link
        </p>
      </div>

      <AuthError message={error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            disabled={isLoading}
            className={cn("h-11 rounded-lg bg-background text-sm", errors.email && EMPTY_FIELD)}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-lg text-[0.95rem]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </AuthForm>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          disabled={isLoading}
          onClick={onSignIn}
        >
          Sign in
        </Button>
      </p>
    </motion.div>
  );
}

// --------------------------------
// Check email
// --------------------------------

function AuthCheckEmail({
  copy,
  onSignIn,
}: {
  copy: CheckEmailCopy;
  onSignIn: () => void;
}) {
  return (
    <motion.div
      data-slot="auth-check-email"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col items-center p-8 text-center"
    >
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
        <MailCheck className="size-8 text-primary" aria-hidden />
      </div>

      <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 h-11 w-full max-w-xs rounded-lg"
        onClick={onSignIn}
      >
        Back to sign in
      </Button>

      <p className="mt-6 text-xs text-muted-foreground">
        No email? Check your spam folder, or ask us to resend it.
      </p>
    </motion.div>
  );
}

// --------------------------------
// Reset password (from the recovery link)
// --------------------------------

function AuthResetPassword({ next }: { next: string }) {
  const supabase = useAuthClient();
  const complete = useCompleteAuth(next);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setError(missingConfigMessage());
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      complete();
    } catch {
      setError("An unexpected error occurred. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      data-slot="auth-reset-password"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="p-8"
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick something you have not used before
        </p>
      </div>

      <AuthError message={error} />

      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isLoading}
            className={cn(
              "h-11 rounded-lg bg-background text-sm",
              errors.password && EMPTY_FIELD,
            )}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isLoading}
            className={cn(
              "h-11 rounded-lg bg-background text-sm",
              errors.confirmPassword && EMPTY_FIELD,
            )}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-lg text-[0.95rem]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Updating...
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </AuthForm>
    </motion.div>
  );
}
