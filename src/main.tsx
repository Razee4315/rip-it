import "@fontsource/anton/400.css";
import "@fontsource-variable/outfit";
import "./styles/app.css";
import ReactDOM from "react-dom/client";
import App from "./App";

// No StrictMode: the engine owns a WebGL context and must be created exactly once.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
