import type { DecryptionInput, TxSecureRecord } from "@mirfa/crypto";
import { EncryptionService } from "@mirfa/crypto";

export class ApiEncryptionService {
  private encryption: EncryptionService;

  constructor(masterKey: string) {
    this.encryption = new EncryptionService(masterKey);
  }

  encryptPayload(partyId: string, payload: Record<string, unknown>): TxSecureRecord {
    return this.encryption.encryptPayload(partyId, payload).record;
  }

  decryptRecord(record: TxSecureRecord): Record<string, unknown> {
    const input: DecryptionInput = record;

    return this.encryption.decryptPayload(input);
  }
}
