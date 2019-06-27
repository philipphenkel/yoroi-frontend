/**
 * Flowtype definitions for index
 * Generated by Flowgen from a Typescript Definition
 * Flowgen v1.8.3
 * Author: [Joar Wilk](http://twitter.com/joarwilk)
 * Repo: http://github.com/joarwilk/flowgen
 */

declare module 'lovefield' {
  declare var lf: typeof npm$namespace$lf;

  declare var npm$namespace$lf: {
    bind: typeof lf$bind,

    Order: typeof lf$Order,
    Type: typeof lf$Type,
    ConstraintAction: typeof lf$ConstraintAction,
    ConstraintTiming: typeof lf$ConstraintTiming,
    TransactionType: typeof lf$TransactionType,

    schema: typeof npm$namespace$lf$schema,
    op: typeof npm$namespace$lf$op,
    fn: typeof npm$namespace$lf$fn
  };

  declare var lf$Order: {|
    +ASC: 0, // 0
    +DESC: 1 // 1
  |};

  declare var lf$Type: {|
    +ARRAY_BUFFER: 0, // 0
    +BOOLEAN: 1, // 1
    +DATE_TIME: 2, // 2
    +INTEGER: 3, // 3
    +NUMBER: 4, // 4
    +OBJECT: 5, // 5
    +STRING: 6 // 6
  |};

  declare var lf$ConstraintAction: {|
    +RESTRICT: 0, // 0
    +CASCADE: 1 // 1
  |};

  declare var lf$ConstraintTiming: {|
    +IMMEDIATE: 0, // 0
    +DEFERRABLE: 1 // 1
  |};

  declare interface lf$Binder {
    getIndex(): number;
  }

  declare interface lf$Predicate {}

  declare interface lf$Row {}

  declare type lf$ValueLiteral = string | number | boolean | Date;

  declare interface lf$PredicateProvider {
    eq(operand: lf$ValueLiteral | lf$schema$Column | lf$Binder): lf$Predicate;
    neq(operand: lf$ValueLiteral | lf$schema$Column | lf$Binder): lf$Predicate;
    lt(operand: lf$ValueLiteral | lf$schema$Column | lf$Binder): lf$Predicate;
    lte(operand: lf$ValueLiteral | lf$schema$Column | lf$Binder): lf$Predicate;
    gt(operand: lf$ValueLiteral | lf$schema$Column | lf$Binder): lf$Predicate;
    gte(operand: lf$ValueLiteral | lf$schema$Column | lf$Binder): lf$Predicate;
    match(operand: RegExp | lf$Binder): lf$Predicate;
    between(
      from: lf$ValueLiteral | lf$Binder,
      to: lf$ValueLiteral | lf$Binder
    ): lf$Predicate;
    in(values: lf$Binder | Array<lf$ValueLiteral>): lf$Predicate;
    isNull(): lf$Predicate;
    isNotNull(): lf$Predicate;
  }

  declare function lf$bind(index: number): lf$Binder;

  declare interface lf$TransactionStats {
    success(): boolean;
    insertedRowCount(): Number;
    updatedRowCount(): Number;
    deletedRowCount(): Number;
    changedTableCount(): Number;
  }

  declare interface lf$Transaction {
    attach(query: lf$query$Builder): Promise<Array<Object>>;
    begin(scope: Array<lf$schema$Table>): Promise<void>;
    commit(): Promise<void>;
    exec(queries: Array<lf$query$Builder>): Promise<Array<Array<Object>>>;
    rollback(): Promise<void>;
    stats(): lf$TransactionStats;
  }

  declare var lf$TransactionType: {|
    +READ_ONLY: 0, // 0
    +READ_WRITE: 1 // 1
  |};

  declare interface lf$Database {
    close(): void;
    createTransaction(type?: $Values<typeof lf$TransactionType>): lf$Transaction;
    delete(): lf$query$Delete;
    declare(): Promise<Object>;
    getSchema(): lf$schema$Database;
    import(data: Object): Promise<void>;
    insertOrReplace(): lf$query$Insert;
    insert(): lf$query$Insert;
    observe(query: lf$query$Select, callback: Function): void;
    select(...columns: lf$schema$Column[]): lf$query$Select;
    unobserve(query: lf$query$Select, callback: Function): void;
    update(table: lf$schema$Table): lf$query$Update;
  }

  declare interface lf$query$Builder {
    bind(...values: any[]): lf$query$Builder;
    exec(): Promise<Array<Object>>;
    explain(): string;
    toSql(): string;
  }

  declare type lf$query$Delete = {
    from(table: lf$schema$Table): lf$query$Delete,
    where(predicate: lf$Predicate): lf$query$Delete
  } & lf$query$Builder;

  declare type lf$query$Insert = {
    into(table: lf$schema$Table): lf$query$Insert,
    values(rows: Array<lf$Row> | lf$Binder | Array<lf$Binder>): lf$query$Insert
  } & lf$query$Builder;

  declare type lf$query$Select = {
    from(...tables: lf$schema$Table[]): lf$query$Select,
    groupBy(...columns: lf$schema$Column[]): lf$query$Select,
    innerJoin(table: lf$schema$Table, predicate: lf$Predicate): lf$query$Select,
    leftOuterJoin(
      table: lf$schema$Table,
      predicate: lf$Predicate
    ): lf$query$Select,
    limit(numberOfRows: lf$Binder | number): lf$query$Select,
    orderBy(
      column: lf$schema$Column,
      order?: $Values<typeof lf$Order>
    ): lf$query$Select,
    skip(numberOfRows: lf$Binder | number): lf$query$Select,
    where(predicate: lf$Predicate): lf$query$Select
  } & lf$query$Builder;

  declare type lf$query$Update = {
    set(column: lf$schema$Column, value: any): lf$query$Update,
    where(predicate: lf$Predicate): lf$query$Update
  } & lf$query$Builder;

  declare interface lf$raw$BackStore {
    getRawDBInstance(): any;
    getRawTransaction(): any;
    dropTable(tableName: string): Promise<void>;
    addTableColumn(
      tableName: string,
      columnName: string,
      defaultValue: string | boolean | number | Date | ArrayBuffer
    ): Promise<void>;
    dropTableColumn(tableName: string, columnName: string): Promise<void>;
    renameTableColumn(
      tableName: string,
      oldColumnName: string,
      newColumnName: string
    ): Promise<void>;
    createRow(payload: Object): lf$Row;
    getVersion(): number;
    dump(): Array<Object>;
  }

  declare var npm$namespace$lf$schema: {
    create: typeof lf$schema$create,

    DataStoreType: typeof lf$schema$DataStoreType
  };

  declare var lf$schema$DataStoreType: {|
    +INDEXED_DB: 0, // 0
    +MEMORY: 1, // 1
    +LOCAL_STORAGE: 2, // 2
    +FIREBASE: 3, // 3
    +WEB_SQL: 4 // 4
  |};

  declare interface lf$schema$DatabasePragma {
    enableBundledMode: boolean;
  }

  declare interface lf$schema$Database {
    name(): string;
    pragma(): lf$schema$DatabasePragma;
    tables(): Array<lf$schema$Table>;
    table(tableName: string): lf$schema$Table;
    version(): number;
  }

  declare type lf$schema$Column = {
    as(name: string): lf$schema$Column,
    getName(): string,
    getNormalizedName(): string
  } & lf$PredicateProvider;

  declare interface lf$schema$Table {
    as(name: string): lf$schema$Table;
    createRow(value: Object): lf$Row;
    getName(): string;
    [key: string]: lf$schema$Column;
  }

  declare interface lf$schema$ConnectOptions {
    onUpgrade?: (rawDb: lf$raw$BackStore) => Promise<void>;
    storeType?: $Values<typeof lf$schema$DataStoreType>;
    webSqlDbSize?: number;
  }

  declare interface lf$schema$Builder {
    connect(options?: lf$schema$ConnectOptions): Promise<lf$Database>;
    createTable(tableName: string): lf$schema$TableBuilder;
    getSchema(): lf$schema$Database;
    setPragma(pragma: lf$schema$DatabasePragma): void;
  }

  declare interface lf$schema$IndexedColumn {
    autoIncrement: boolean;
    name: string;
    order: $Values<typeof lf$Order>;
  }

  declare type lf$schema$RawForeignKeySpec = {
    local: string,
    ref: string,
    action?: $Values<typeof lf$ConstraintAction>,
    timing?: $Values<typeof lf$ConstraintTiming>
  };

  declare interface lf$schema$TableBuilder {
    addColumn(
      name: string,
      type: $Values<typeof lf$Type>
    ): lf$schema$TableBuilder;
    addForeignKey(
      name: string,
      spec: lf$schema$RawForeignKeySpec
    ): lf$schema$TableBuilder;
    addIndex(
      name: string,
      columns: Array<string> | Array<lf$schema$IndexedColumn>,
      unique?: boolean,
      order?: $Values<typeof lf$Order>
    ): lf$schema$TableBuilder;
    addNullable(columns: Array<string>): lf$schema$TableBuilder;
    addPrimaryKey(
      columns: Array<string> | Array<lf$schema$IndexedColumn>,
      autoInc?: boolean
    ): lf$schema$TableBuilder;
    addUnique(name: string, columns: Array<string>): lf$schema$TableBuilder;
  }

  declare function lf$schema$create(
    dbName: string,
    dbVersion: number
  ): lf$schema$Builder;

  declare var npm$namespace$lf$op: {
    and: typeof lf$op$and,
    not: typeof lf$op$not,
    or: typeof lf$op$or
  };
  declare function lf$op$and(...args: lf$Predicate[]): lf$Predicate;

  declare function lf$op$not(operand: lf$Predicate): lf$Predicate;

  declare function lf$op$or(...args: lf$Predicate[]): lf$Predicate;

  declare var npm$namespace$lf$fn: {
    avg: typeof lf$fn$avg,
    count: typeof lf$fn$count,
    distinct: typeof lf$fn$distinct,
    geomean: typeof lf$fn$geomean,
    max: typeof lf$fn$max,
    min: typeof lf$fn$min,
    stddev: typeof lf$fn$stddev,
    sum: typeof lf$fn$sum
  };
  declare function lf$fn$avg(column: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$count(column?: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$distinct(column: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$geomean(column: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$max(column: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$min(column: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$stddev(column: lf$schema$Column): lf$schema$Column;

  declare function lf$fn$sum(column: lf$schema$Column): lf$schema$Column;

  declare module.exports: typeof lf;
}
