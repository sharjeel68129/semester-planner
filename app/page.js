"use client";
import { useState } from "react";

export default function Home() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("Extracting...");
    const res = await fetch("/api/extract", { method: "POST", body: new FormData(e.target) });
    const data = await res.json();
    if (!res.ok) return setStatus(data.error || "Failed");
    setEvents(data.events);
    setStatus(`${data.events.length} events found`);
  }

  return (
    <main>
      <h1>AI Semester Planner</h1>
      <form onSubmit={onSubmit}>
        <input type="file" name="files" accept=".pdf,.docx,.txt" multiple required />
        <label> Start <input type="date" name="start" required /></label>
        <label> End <input type="date" name="end" required /></label>
        <button type="submit">Extract</button>
      </form>
      <p>{status}</p>
      {/* TODO (Review person): editable table, highlight needsReview() rows */}
      {/* TODO (Calendar person): "Download .ics" button using toIcs() */}
      <pre>{JSON.stringify(events, null, 2)}</pre>
    </main>
  );
}
