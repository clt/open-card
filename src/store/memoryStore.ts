import { notFound } from "../domain/errors";
import type { Table } from "../domain/table";

export interface TableStore {
  create(table: Table): Table;
  get(tableId: string): Table | undefined;
  require(tableId: string): Table;
  update(table: Table): void;
  list(): Table[];
  reset(): void;
}

export class MemoryTableStore implements TableStore {
  private readonly tables = new Map<string, Table>();

  create(table: Table): Table {
    const storedTable = structuredClone(table);
    this.tables.set(storedTable.id, storedTable);
    return structuredClone(storedTable);
  }

  get(tableId: string): Table | undefined {
    const table = this.tables.get(tableId);
    return table === undefined ? undefined : structuredClone(table);
  }

  require(tableId: string): Table {
    const table = this.get(tableId);

    if (table === undefined) {
      notFound(`Table ${tableId} not found.`);
    }

    return table;
  }

  update(table: Table): void {
    this.tables.set(table.id, structuredClone(table));
  }

  list(): Table[] {
    return [...this.tables.values()].map((t) => structuredClone(t));
  }

  reset(): void {
    this.tables.clear();
  }
}

export const memoryStore = new MemoryTableStore();
