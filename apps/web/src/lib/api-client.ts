import type { TxSecureRecord } from "@mirfa/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  requestId?: string;

  constructor(
    public status: number,
    message: string,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.requestId = requestId;
  }
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  requestId?: string;
}

interface HealthResponse {
  status: "ok";
  timestamp: string;
  transactions: number;
  uptimeSeconds: number;
  version: string;
}

interface TransactionListResponse {
  success: boolean;
  count: number;
  records: TxSecureRecord[];
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "Unknown error" }))) as
      ApiErrorResponse;

    throw new ApiError(
      response.status,
      error.message || error.error || `HTTP ${response.status}`,
      error.requestId,
    );
  }

  return (await response.json()) as T;
}

async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: withTimeoutSignal(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(
        408,
        `Request timed out while reaching ${input}. Check API server status/network.`,
      );
    }

    throw new ApiError(
      0,
      `Network request failed. Unable to reach ${input}. Ensure API is running and NEXT_PUBLIC_API_URL is correct.`,
    );
  }
}

export async function encryptTransaction(
  partyId: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; id: string; record: TxSecureRecord }> {
  const response = await safeFetch(`${API_URL}/tx/encrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partyId, payload }),
  });

  return handleResponse(response);
}

export async function getTransaction(
  id: string,
): Promise<{ success: boolean; record: TxSecureRecord }> {
  const response = await safeFetch(`${API_URL}/tx/${id}`, {
    method: "GET",
  });
  return handleResponse(response);
}

export async function decryptTransaction(
  id: string,
): Promise<{ success: boolean; payload: Record<string, unknown> }> {
  const response = await safeFetch(`${API_URL}/tx/${id}/decrypt`, {
    method: "POST",
  });

  return handleResponse(response);
}

export async function listTransactions(
  partyId?: string,
): Promise<TransactionListResponse> {
  const query = partyId ? `?partyId=${encodeURIComponent(partyId)}` : "";
  const response = await safeFetch(`${API_URL}/tx${query}`, {
    method: "GET",
  });
  return handleResponse(response);
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await safeFetch(`${API_URL}/health`, {
    method: "GET",
  });
  return handleResponse(response);
}
