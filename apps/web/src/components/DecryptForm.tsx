"use client";

import { useState } from "react";
import type { TxSecureRecord } from "@mirfa/crypto";
import {
  ApiError,
  decryptTransaction,
  getTransaction,
} from "@/lib/api-client";

interface DecryptFormProps {
  txId: string;
  onTxIdChange: (value: string) => void;
  onFetchedRecord: (record: TxSecureRecord) => void;
  onDecrypted: (payload: Record<string, unknown>) => void;
  recentIds: string[];
  onLoadLatest: () => Promise<void>;
}

const TX_ID_PATTERN = /^tx_[a-f0-9]{32}$/;

export function DecryptForm({
  txId,
  onTxIdChange,
  onFetchedRecord,
  onDecrypted,
  recentIds,
  onLoadLatest,
}: DecryptFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const isTxIdValid = TX_ID_PATTERN.test(txId);

  const handleFetch = async () => {
    if (!txId) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await getTransaction(txId);
      onFetchedRecord(result.record);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.requestId ? `${err.message} (requestId: ${err.requestId})` : err.message);
      } else {
        setError("Failed to fetch transaction");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!txId) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await decryptTransaction(txId);
      onDecrypted(result.payload);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.requestId ? `${err.message} (requestId: ${err.requestId})` : err.message);
      } else {
        setError("Failed to decrypt transaction");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLatest = async () => {
    setLoadingLatest(true);
    setError(null);
    try {
      await onLoadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load latest transactions");
    } finally {
      setLoadingLatest(false);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>2. Fetch & Decrypt</h2>
        <button
          type="button"
          className="ghost-btn"
          onClick={handleLoadLatest}
          disabled={loadingLatest}
        >
          {loadingLatest ? "Syncing..." : "Sync Latest IDs"}
        </button>
      </div>

      <div className="form-grid">
        <label>
          Transaction ID
          <input
            type="text"
            value={txId}
            onChange={(event) => onTxIdChange(event.target.value)}
            placeholder="tx_..."
            list="recent-tx-list"
          />
        </label>
        <datalist id="recent-tx-list">
          {recentIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>

        {recentIds.length > 0 ? (
          <div className="chip-row">
            {recentIds.slice(0, 5).map((id) => (
              <button
                type="button"
                className="chip"
                key={id}
                onClick={() => onTxIdChange(id)}
              >
                {id}
              </button>
            ))}
          </div>
        ) : null}

        <div className="inline-actions">
          <button type="button" onClick={handleFetch} disabled={loading || !isTxIdValid}>
            {loading ? "Fetching..." : "Fetch Encrypted Record"}
          </button>

          <button type="button" onClick={handleDecrypt} disabled={loading || !isTxIdValid}>
            {loading ? "Decrypting..." : "Decrypt Payload"}
          </button>
        </div>

        {!isTxIdValid && txId ? (
          <p className="error-text">txId must look like: tx_ + 32 lowercase hex chars.</p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
