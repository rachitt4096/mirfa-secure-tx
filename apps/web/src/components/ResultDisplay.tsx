"use client";

import { useState } from "react";

interface ResultDisplayProps {
  title: string;
  data: unknown;
}

export function ResultDisplay({ title, data }: ResultDisplayProps) {
  const [copyLabel, setCopyLabel] = useState("Copy JSON");
  const [expanded, setExpanded] = useState(true);
  const json = JSON.stringify(data, null, 2);
  const byteSize = new TextEncoder().encode(json).length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyLabel("Copied");
      setTimeout(() => setCopyLabel("Copy JSON"), 1500);
    } catch {
      setCopyLabel("Copy failed");
      setTimeout(() => setCopyLabel("Copy JSON"), 1500);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>{title}</h2>
        <div className="inline-actions compact-actions">
          <span className="meta-chip">{byteSize.toLocaleString()} bytes</span>
          <button type="button" className="ghost-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button type="button" className="ghost-btn" onClick={handleCopy}>
            {copyLabel}
          </button>
        </div>
      </div>
      {expanded ? <pre>{json}</pre> : null}
    </section>
  );
}
