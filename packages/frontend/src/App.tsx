import { useEffect, useState } from "react";

type CheckStatus = "pending" | "ok" | "error";

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:4000/graphql";

async function queryGraphQL<T>(query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "GraphQL error");
  return json.data as T;
}

function StatusRow({ label, status }: { label: string; status: CheckStatus }) {
  const text = status === "pending" ? "Checking…" : status === "ok" ? "Connected" : "Unreachable";
  return (
    <div className="status-row">
      <span className={`status-dot ${status}`} />
      <span>{label}: {text}</span>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [apiStatus, setApiStatus] = useState<CheckStatus>("pending");
  const [dbStatus, setDbStatus] = useState<CheckStatus>("pending");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    queryGraphQL<{ health: string }>("{ health }")
      .then((data) => setApiStatus(data.health === "ok" ? "ok" : "error"))
      .catch(() => setApiStatus("error"));

    queryGraphQL<{ dbHealth: string }>("{ dbHealth }")
      .then((data) => setDbStatus(data.dbHealth === "ok" ? "ok" : "error"))
      .catch(() => setDbStatus("error"));
  }, []);

  return (
    <>
      <div className="scene" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Coverage Copilot</h1>
        <button
          className="btn"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          Toggle mode
        </button>
      </div>
      <p className="sub">Milestone 1 — scaffold. This checks that the GraphQL API and Postgres are wired up end to end.</p>

      <div className="glass status-card">
        <StatusRow label="GraphQL API" status={apiStatus} />
        <StatusRow label="Postgres" status={dbStatus} />
      </div>
    </>
  );
}
