import type { TxSecureRecord } from "@mirfa/crypto";

export class StorageService {
  private store = new Map<string, TxSecureRecord>();

  save(record: TxSecureRecord): void {
    this.store.set(record.id, structuredClone(record));
  }

  findById(id: string): TxSecureRecord | undefined {
    const found = this.store.get(id);
    return found ? structuredClone(found) : undefined;
  }

  findByPartyId(partyId: string): TxSecureRecord[] {
    return this.list().filter((record) => record.partyId === partyId);
  }

  list(): TxSecureRecord[] {
    return Array.from(this.store.values())
      .map((record) => structuredClone(record))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  count(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
