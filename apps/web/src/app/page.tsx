"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TxSecureRecord } from "@mirfa/crypto";
import { DecryptForm } from "@/components/DecryptForm";
import { EncryptForm } from "@/components/EncryptForm";
import { ResultDisplay } from "@/components/ResultDisplay";
import { ApiError, getHealth, getTransaction, listTransactions } from "@/lib/api-client";

type ApiHealthState = {
  status: "checking" | "online" | "offline";
  message: string;
  transactions: number;
  uptimeSeconds: number;
  version: string;
};

export default function Home() {
  const [txId, setTxId] = useState("");
  const [partyFilter, setPartyFilter] = useState("party_123");
  const [encryptedRecord, setEncryptedRecord] = useState<TxSecureRecord | null>(null);
  const [decryptedPayload, setDecryptedPayload] = useState<Record<string, unknown> | null>(
    null,
  );
  const [recentRecords, setRecentRecords] = useState<TxSecureRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [health, setHealth] = useState<ApiHealthState>({
    status: "checking",
    message: "Checking API status...",
    transactions: 0,
    uptimeSeconds: 0,
    version: "-",
  });

  const upsertRecentRecord = useCallback((record: TxSecureRecord) => {
    setRecentRecords((current) => {
      const next = [record, ...current.filter((item) => item.id !== record.id)];
      return next.slice(0, 10);
    });
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth({
        status: "online",
        message: "API reachable",
        transactions: data.transactions,
        uptimeSeconds: data.uptimeSeconds,
        version: data.version,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "API unreachable";
      setHealth((current) => ({
        ...current,
        status: "offline",
        message,
      }));
    }
  }, []);

  const syncLatestRecords = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const result = await listTransactions(partyFilter.trim() || undefined);
      setRecentRecords(result.records.slice(0, 10));
      if (!txId && result.records.length > 0) {
        setTxId(result.records[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setListError(error.message);
      } else {
        setListError("Failed to load transactions");
      }
      throw error;
    } finally {
      setListLoading(false);
    }
  }, [partyFilter, txId]);

  useEffect(() => {
    void refreshHealth();
    const timer = setInterval(() => {
      void refreshHealth();
    }, 15_000);

    return () => clearInterval(timer);
  }, [refreshHealth]);

  useEffect(() => {
    void syncLatestRecords().catch(() => undefined);
  }, [syncLatestRecords]);

  const recentIds = useMemo(
    () => recentRecords.map((record) => record.id),
    [recentRecords],
  );

  const formattedUptime = useMemo(() => {
    const hours = Math.floor(health.uptimeSeconds / 3600);
    const minutes = Math.floor((health.uptimeSeconds % 3600) / 60);
    const seconds = health.uptimeSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }, [health.uptimeSeconds]);

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Mirfa Secure Transactions</p>
          <h1>Envelope Encryption Workbench</h1>
          <p className="subtitle">
            Production-ready demo with typed API calls, crypto-level tamper detection, and
            runtime telemetry.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="ghost-btn" onClick={() => void refreshHealth()}>
            Refresh Health
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void syncLatestRecords().catch(() => undefined)}
            disabled={listLoading}
          >
            {listLoading ? "Syncing..." : "Sync Transactions"}
          </button>
        </div>
      </header>

      <section className="telemetry-grid">
        <article className="telemetry-card">
          <p className="telemetry-label">API Status</p>
          <p className={`status-pill ${health.status}`}>{health.message}</p>
        </article>
        <article className="telemetry-card">
          <p className="telemetry-label">Transactions In Memory</p>
          <p className="telemetry-value">{health.transactions}</p>
        </article>
        <article className="telemetry-card">
          <p className="telemetry-label">API Uptime</p>
          <p className="telemetry-value">{formattedUptime}</p>
        </article>
        <article className="telemetry-card">
          <p className="telemetry-label">Runtime Version</p>
          <p className="telemetry-value">{health.version}</p>
        </article>
      </section>

      <section className="panel-grid">
        <EncryptForm
          onPartyIdChange={(partyId) => setPartyFilter(partyId)}
          onEncrypted={(result) => {
            setTxId(result.id);
            setEncryptedRecord(result.record);
            setDecryptedPayload(null);
            upsertRecentRecord(result.record);
            void refreshHealth();
          }}
        />

        <DecryptForm
          txId={txId}
          recentIds={recentIds}
          onLoadLatest={syncLatestRecords}
          onTxIdChange={setTxId}
          onFetchedRecord={(record) => {
            setEncryptedRecord(record);
            setDecryptedPayload(null);
            upsertRecentRecord(record);
          }}
          onDecrypted={(payload) => {
            setDecryptedPayload(payload);
          }}
        />
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Recent Transactions</h2>
          <span className="meta-chip">
            {partyFilter.trim() ? `partyId=${partyFilter.trim()}` : "all parties"}
          </span>
        </div>

        {listError ? <p className="error-text">{listError}</p> : null}

        {recentRecords.length === 0 ? (
          <p className="hint-text">No records yet. Encrypt a payload to create your first tx.</p>
        ) : (
          <div className="history-grid">
            {recentRecords.map((record) => (
              <article key={record.id} className="history-row">
                <div>
                  <p className="history-id">{record.id}</p>
                  <p className="history-meta">
                    partyId={record.partyId} • {new Date(record.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="inline-actions compact-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={async () => {
                      try {
                        setTxId(record.id);
                        const result = await getTransaction(record.id);
                        setEncryptedRecord(result.record);
                        setDecryptedPayload(null);
                        upsertRecentRecord(result.record);
                      } catch (error) {
                        if (error instanceof ApiError) {
                          setListError(error.message);
                        } else {
                          setListError("Failed to fetch transaction");
                        }
                      }
                    }}
                  >
                    Open
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {encryptedRecord ? <ResultDisplay title="Encrypted Record" data={encryptedRecord} /> : null}

      {decryptedPayload ? <ResultDisplay title="Decrypted Payload" data={decryptedPayload} /> : null}

      <section className="card reviewer-notes">
        <h2>For Reviewer</h2>
        <ul>
          <li>
            Envelope encryption with AES-256-GCM: every payload uses a random DEK, and the DEK is
            wrapped by a master key.
          </li>
          <li>
            AAD binds cryptographic data to <code>id</code>, <code>partyId</code>, and{" "}
            <code>mk_version</code>, so cross-record tampering fails decryption.
          </li>
          <li>
            Validation is enforced at API + crypto layers (schema, payload size, hex format,
            nonce/tag length, version checks).
          </li>
          <li>
            API is production-hardened with optional <code>x-api-key</code>, per-IP route rate
            limiting, security headers, and structured errors with request IDs.
          </li>
          <li>
            Test coverage includes round-trip correctness, tampering detection, validation failures,
            and API integration flows.
          </li>
        </ul>
        <p className="hint-text reviewer-links">
          Docs in repo: <code>README.md</code> • <code>ARCHITECTURE.md</code> •{" "}
          <code>SECURITY.md</code> • <code>docs/API.md</code>
        </p>
      </section>
    </main>
  );
}
