import { createRoot } from "react-dom/client";
import { StartupError } from "./components/StartupError";
import { readSupabaseConfiguration } from "./lib/supabase-config";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Unable to find the application root element.");
}

const root = createRoot(rootElement);
const configuration = readSupabaseConfiguration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

if (configuration.ok === false) {
  root.render(<StartupError message={configuration.message} />);
} else {
  import("./App.tsx")
    .then(({ default: App }) => root.render(<App />))
    .catch((error: unknown) => {
      console.error("Unable to start the application:", error);
      root.render(
        <StartupError message="The application failed to start. Please try again later." />,
      );
    });
}
