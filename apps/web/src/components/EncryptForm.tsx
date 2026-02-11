"use client";

import { useState } from "react";
import type { TxSecureRecord } from "@mirfa/crypto";
import { ApiError, encryptTransaction } from "@/lib/api-client";

interface EncryptFormProps {
  onEncrypted: (result: { id: string; record: TxSecureRecord }) => void;
  onPartyIdChange?: (partyId: string) => void;
}

const PARTY_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;
const payloadTemplates: Record<string, string> = {
  payment: '{\n  "amount": 100,\n  "currency": "AED",\n  "type": "payment"\n}',
  refund: '{\n  "amount": 32,\n  "currency": "AED",\n  "type": "refund",\n  "reason": "duplicate charge"\n}',
  payroll:
    '{\n  "batchId": "pay_2026_02",\n  "employees": 12,\n  "total": 43120.55,\n  "currency": "AED"\n}',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function EncryptForm({ onEncrypted, onPartyIdChange }: EncryptFormProps) {
  const [partyId, setPartyId] = useState("party_123");
  const [payloadText, setPayloadText] = useState(payloadTemplates.payment);
  const [template, setTemplate] = useState<keyof typeof payloadTemplates>("payment");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isPartyIdValid = PARTY_ID_PATTERN.test(partyId.trim());
  const payloadBytes = new TextEncoder().encode(payloadText).length;
  const payloadSizeLabel = `${payloadBytes.toLocaleString()} bytes`;

  const updatePartyId = (value: string) => {
    setPartyId(value);
    onPartyIdChange?.(value.trim());
  };

  const handleEncrypt = async () => {
    setError(null);
    setLoading(true);

    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!isPlainObject(parsed)) {
        throw new Error("Payload must be a valid JSON object");
      }

      const normalizedPartyId = partyId.trim();
      if (!PARTY_ID_PATTERN.test(normalizedPartyId)) {
        throw new Error("partyId must be 3-64 chars and contain only letters, digits, _ or -");
      }

      const result = await encryptTransaction(normalizedPartyId, parsed);
      onEncrypted({ id: result.id, record: result.record });
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON in payload");
      } else if (err instanceof ApiError) {
        setError(err.requestId ? `${err.message} (requestId: ${err.requestId})` : err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to encrypt transaction");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!isPlainObject(parsed)) {
        setError("Payload must be a valid JSON object");
        return;
      }
      setPayloadText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      setError("Cannot format: payload is not valid JSON");
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>1. Encrypt & Store</h2>
        <span className="meta-chip">{payloadSizeLabel}</span>
      </div>

      <div className="form-grid">
        <label>
          Party ID
          <input
            type="text"
            value={partyId}
            onChange={(event) => updatePartyId(event.target.value)}
            placeholder="party_123"
          />
        </label>

        <label>
          Payload Template
          <select
            value={template}
            onChange={(event) => {
              const selected = event.target.value as keyof typeof payloadTemplates;
              setTemplate(selected);
              setPayloadText(payloadTemplates[selected]);
              setError(null);
            }}
          >
            <option value="payment">Payment</option>
            <option value="refund">Refund</option>
            <option value="payroll">Payroll Batch</option>
          </select>
        </label>

        <label>
          JSON Payload
          <textarea
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            rows={8}
          />
        </label>

        <div className="inline-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={handleFormatJson}
            disabled={loading}
          >
            Format JSON
          </button>

          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setPayloadText(payloadTemplates[template]);
              setError(null);
            }}
            disabled={loading}
          >
            Reset Payload
          </button>
        </div>

        <button type="button" onClick={handleEncrypt} disabled={loading || !isPartyIdValid}>
          {loading ? "Encrypting..." : "Encrypt & Save"}
        </button>

        {!isPartyIdValid ? (
          <p className="error-text">partyId must match pattern [a-zA-Z0-9_-] with length 3-64.</p>
        ) : null}

        <p className="hint-text">
          Encrypted with a unique DEK, then DEK wrapped by master key (envelope encryption).
        </p>

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
