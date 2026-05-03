import { notFound } from "../domain/errors";
import type { Table } from "../domain/table";

export interface TableStore {
  create(table: Table): Table;
  get(tableId: string): Table | undefined;
  require(tableId: string): Table;
  list(): Table[];
  reset(): void;
}

export class MemoryTableStore implements TableStore {
  private readonly tables = new Map<string, Table>();

  create(table: Table): Table {
    this.tables.set(table.id, table);
    return table;
  }

  get(tableId: string): Table | undefined {
    return this.tables.get(tableId);
  }

  require(tableId: string): Table {
    const table = this.get(tableId);

    if (table === undefined) {
      notFound(`Table ${tableId} not found.`);
    }

    return table;
  }

  list(): Table[] {
    return [...this.tables.values()];
  }

  reset(): void {
    this.tables.clear();
  }
}

export const memoryStore = new MemoryTableStore();
