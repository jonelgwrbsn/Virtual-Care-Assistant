interface StartupErrorProps {
  message: string;
}

export const StartupError = ({ message }: StartupErrorProps) => (
  <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground">
    <section
      aria-labelledby="startup-error-title"
      className="w-full max-w-xl rounded-2xl border border-border bg-card p-7 shadow-lg sm:p-9"
    >
      <p className="text-sm font-semibold text-primary">Virtual Care Assistant</p>
      <h1 id="startup-error-title" className="mt-3 text-2xl font-bold tracking-tight">
        Configuration required
      </h1>
      <p role="alert" className="mt-3 text-sm text-destructive">
        {message}
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          In Vercel, open your project&apos;s <strong>Settings → Environment Variables</strong>.
        </li>
        <li>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from
          your Supabase project settings.
        </li>
        <li>Save the variables and redeploy so Vite includes them in the production build.</li>
      </ol>
      <p className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        These values are public browser configuration. Never use a Supabase service-role key here
        or commit secrets to source control.
      </p>
    </section>
  </main>
);
