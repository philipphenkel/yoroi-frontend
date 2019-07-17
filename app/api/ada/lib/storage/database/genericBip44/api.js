// @flow

import type {
  lf$Database,
  lf$Transaction,
} from 'lovefield';

import type {
  Bip44DerivationMappingInsert, Bip44DerivationMappingRow,
  Bip44DerivationInsert,
  Bip44DerivationRow,
  Bip44RootInsert, Bip44RootRow,
  Bip44PurposeInsert, Bip44PurposeRow,
  Bip44CoinTypeInsert, Bip44CoinTypeRow,
  Bip44AccountInsert, Bip44AccountRow,
  Bip44ChainInsert, Bip44ChainRow,
  Bip44AddressInsert, Bip44AddressRow,
  PrivateDeriverInsert, PrivateDeriverRow,
  PublicDeriverInsert, PublicDeriverRow,
  Bip44WrapperInsert, Bip44WrapperRow,
} from './tables';
import * as Tables from './tables';
import type { KeyInsert } from '../uncategorized/tables';
import { addKey } from '../uncategorized/api';
import { addToTable, getRowIn, getRowFromKey } from '../utils';
import type { AddRowRequest } from '../utils';

/**
 * A specific number means you only care about the specific index
 * Null indicates querying all derivations at the level
 */
export type BIP32QueryPath = Array<number | null>;
type PathMapType = Map<number, Array<number>>;

export const DerivationLevels = Object.freeze({
  ROOT: {
    level: 0,
    table: Tables.Bip44RootSchema,
  },
  PURPOSE: {
    level: 1,
    table: Tables.Bip44PurposeSchema,
  },
  COIN_TYPE: {
    level: 2,
    table: Tables.Bip44CoinTypeSchema,
  },
  ACCOUNT: {
    level: 3,
    table: Tables.Bip44AccountSchema,
  },
  CHAIN: {
    level: 4,
    table: Tables.Bip44ChainSchema,
  },
  ADDRESS: {
    level: 5,
    table: Tables.Bip44AddressSchema,
  },
});
export const TableMap = new Map<number, any>(
  Object.keys(DerivationLevels)
    .map(key => DerivationLevels[key])
    .map(val => [val.level, val.table.name])
);

/**
 * @param {*} derivationId the derivation id for the last element of `commonPrefix`
 */
export const getDerivationsByPath = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationId: number,
  commonPrefix: Array<number>,
  queryPath: BIP32QueryPath,
): Promise<PathMapType> => {
  const pathMap = new Map([[derivationId, commonPrefix]]);
  const result = await _getDerivationsByPath(
    db,
    tx,
    pathMap,
    commonPrefix.concat(queryPath),
    commonPrefix.length,
  );
  return result;
};

export const _getDerivationsByPath = async (
  db: lf$Database,
  tx: lf$Transaction,
  pathMap: PathMapType,
  queryPath: BIP32QueryPath,
  currPathIndex: number,
): Promise<PathMapType> => {
  // base case
  if (currPathIndex === queryPath.length) {
    return pathMap;
  }

  const mappingTable = db.getSchema().table(Tables.Bip44DerivationMappingSchema.name);
  const derivationTable = db.getSchema().table(Tables.Bip44DerivationSchema.name);

  const conditions = [
    mappingTable[Tables.Bip44DerivationMappingSchema.properties.Parent].in(
      Array.from(pathMap.keys())
    ),
  ];
  // if the query is for a specific index, we need to add the condition to the SQL query
  if (queryPath[currPathIndex] !== null) {
    conditions.push(
      derivationTable[Tables.Bip44DerivationSchema.properties.Index].eq(
        queryPath[currPathIndex]
      ),
    );
  }

  const query = db
    .select()
    .from(mappingTable)
    .innerJoin(
      derivationTable,
      derivationTable[Tables.Bip44DerivationSchema.properties.Bip44DerivationId]
        .eq(mappingTable[Tables.Bip44DerivationMappingSchema.properties.Child]),
    )
    .where(...conditions);

  const queryResult: Array<{
    Bip44DerivationMapping: Bip44DerivationMappingRow,
    Bip44Derivation: Bip44DerivationRow,
  }> = await tx.attach(query);
  const nextPathMap = new Map(queryResult.map(row => {
    const path = pathMap.get(row.Bip44DerivationMapping.Parent);
    if (!path) throw new Error('genericBip44::_getDerivationsByPath Should never happen');
    if (row.Bip44Derivation.Index === null) throw new Error('genericBip44::_getDerivationsByPath null child index');
    return [
      row.Bip44DerivationMapping.Child,
      path.concat([row.Bip44Derivation.Index])
    ];
  }));
  if (nextPathMap.size === 0) {
    throw new Error('genericBip44::_getDerivationsByPath no result');
  }

  const result = _getDerivationsByPath(
    db,
    tx,
    nextPathMap,
    queryPath,
    currPathIndex + 1,
  );
  return result;
};

// ======================
//   Add new toplevel
// ======================

export const addBip44Wrapper = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddRowRequest<Bip44WrapperInsert>,
): Promise<Bip44WrapperRow> => (
  await addToTable<Bip44WrapperInsert, Bip44WrapperRow>(
    db, tx,
    request, Tables.Bip44WrapperSchema.name,
  )
);
export const addPrivateDeriver = async <Insert>(
  db: lf$Database,
  tx: lf$Transaction,
  request: {
    addLevelRequest: AddDerivationRequest<Insert>,
    level: number,
    privateDeriverRequest: number => AddRowRequest<PrivateDeriverInsert>,
  }
) => {
  const levelResult = await addByLevel(
    db, tx,
    request.addLevelRequest,
    request.level,
  );
  const privateDeriverResult = await addToTable<PrivateDeriverInsert, PrivateDeriverRow>(
    db, tx,
    request.privateDeriverRequest(levelResult.derivationTableResult.Bip44DerivationId),
    Tables.PrivateDeriverSchema.name,
  );
  return {
    privateDeriverResult,
    levelResult,
  };
};

export const addPublicDeriver = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddRowRequest<PublicDeriverInsert>,
): Promise<PublicDeriverRow> => (
  await addToTable<PublicDeriverInsert, PublicDeriverRow>(
    db, tx,
    request, Tables.PublicDeriverSchema.name,
  )
);

export const addBip44Root = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Bip44RootInsert>,
) => (
  await _addDerivation<Bip44RootInsert, Bip44RootRow>(
    db, tx,
    request, Tables.Bip44RootSchema.name,
  )
);
export const addBip44Purpose = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Bip44RootInsert>,
) => (
  await _addDerivation<Bip44PurposeInsert, Bip44PurposeRow>(
    db, tx,
    request, Tables.Bip44PurposeSchema.name,
  )
);
export const addBip44CoinType = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Bip44CoinTypeInsert>,
) => (
  await _addDerivation<Bip44CoinTypeInsert, Bip44CoinTypeRow>(
    db, tx,
    request, Tables.Bip44CoinTypeSchema.name,
  )
);
export const addBip44Account = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Bip44AccountInsert>,
) => (
  await _addDerivation<Bip44AccountInsert, Bip44AccountRow>(
    db, tx,
    request, Tables.Bip44AccountSchema.name,
  )
);
export const addBip44Chain = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Bip44ChainInsert>,
) => (
  await _addDerivation<Bip44ChainInsert, Bip44ChainRow>(
    db, tx,
    request, Tables.Bip44ChainSchema.name,
  )
);
export const addBip44Address = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Bip44AddressInsert>,
) => (
  await _addDerivation<Bip44AddressInsert, Bip44AddressRow>(
    db, tx,
    request, Tables.Bip44AddressSchema.name,
  )
);

// ======
//   Get
// ======

export const _getByIds = async<Row>(
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
  tableName: string
): Promise<Array<Row>> => (
  await getRowIn<Row>(
    db,
    tx,
    tableName,
    Tables.Bip44DerivationSchema.properties.Bip44DerivationId,
    derivationIds,
  )
);

export const getBip44Root = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
) => (
  await _getByIds<Bip44RootRow>(
    db, tx, derivationIds, Tables.Bip44RootSchema.name,
  )
);
export const getBip44Purpose = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
) => (
  await _getByIds<Bip44PurposeRow>(
    db, tx, derivationIds, Tables.Bip44PurposeSchema.name,
  )
);
export const getBip44CoinType = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
) => (
  await _getByIds<Bip44CoinTypeRow>(
    db, tx, derivationIds, Tables.Bip44CoinTypeSchema.name,
  )
);
export const getBip44Account = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
) => (
  await _getByIds<Bip44AccountRow>(
    db, tx, derivationIds, Tables.Bip44AccountSchema.name,
  )
);
export const getBip44Chain = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
) => (
  await _getByIds<Bip44ChainRow>(
    db, tx, derivationIds, Tables.Bip44ChainSchema.name,
  )
);
export const getBip44Address = async (
  db: lf$Database,
  tx: lf$Transaction,
  derivationIds: Array<number>,
) => (
  await _getByIds<Bip44AddressRow>(
    db, tx, derivationIds, Tables.Bip44AddressSchema.name,
  )
);

export const getPublicDeriver = async (
  db: lf$Database,
  tx: lf$Transaction,
  key: number,
): Promise<PublicDeriverRow | typeof undefined> => (
  await getRowFromKey<PublicDeriverRow>(
    db,
    tx,
    key,
    Tables.PublicDeriverSchema.name,
    Tables.PublicDeriverSchema.properties.PublicDeriverId,
  )
);

export const getBip44Wrapper = async (
  db: lf$Database,
  tx: lf$Transaction,
  key: number,
): Promise<Bip44WrapperRow | typeof undefined> => (
  await getRowFromKey<Bip44WrapperRow>(
    db,
    tx,
    key,
    Tables.Bip44WrapperSchema.name,
    Tables.Bip44WrapperSchema.properties.Bip44WrapperId,
  )
);

// =======
//   Add
// =======

export type AddDerivationRequest<Insert> = {|
  privateKeyInfo: KeyInsert | null,
  publicKeyInfo: KeyInsert | null,
  derivationInfo: {|
      private: number | null,
      public: number | null,
    |} => Bip44DerivationInsert,
  levelInfo: number => Insert,
|};

async function _addDerivation<Insert, Row>(
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Insert>,
  tableName: string,
): Promise<{
  derivationTableResult: Bip44DerivationRow,
  specificDerivationResult: Row,
}> {
  const privateKey = request.privateKeyInfo === null
    ? null
    : await addKey(
      db,
      tx,
      {
        row: request.privateKeyInfo
      }
    );
  const publicKey = request.publicKeyInfo === null
    ? null
    : await addKey(
      db,
      tx,
      {
        row: request.publicKeyInfo
      }
    );

  const derivationTableResult =
    await addToTable<Bip44DerivationInsert, Bip44DerivationRow>(
      db,
      tx,
      {
        row: request.derivationInfo({
          private: privateKey ? privateKey.KeyId : null,
          public: publicKey ? publicKey.KeyId : null,
        })
      },
      Tables.Bip44DerivationSchema.name,
    );

  const specificDerivationResult =
    await addToTable<Insert, Row>(
      db,
      tx,
      {
        row: request.levelInfo(derivationTableResult.Bip44DerivationId)
      },
      tableName,
    );

  return {
    derivationTableResult,
    specificDerivationResult,
  };
}

export type DeriveFromRequest<T> = {|
  parentDerivationId: number,
  ...AddDerivationRequest<T>
|};

async function _addDerivationWithParent<Insert, Row>(
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Insert>,
  tableName: string,
): Promise<{
  derivationTableResult: Bip44DerivationRow,
  mappingTableResult: Bip44DerivationMappingRow,
  specificDerivationResult: Row,
}> {
  const derivationResult = await _addDerivation<Insert, Row>(
    db, tx,
    {
      privateKeyInfo: request.privateKeyInfo,
      publicKeyInfo: request.publicKeyInfo,
      derivationInfo: request.derivationInfo,
      levelInfo: request.levelInfo,
    },
    tableName,
  );

  const mappingInsert: Bip44DerivationMappingInsert = {
    Parent: request.parentDerivationId,
    Child: derivationResult.derivationTableResult.Bip44DerivationId,
  };

  const mappingTableResult =
    await addToTable<Bip44DerivationMappingInsert, Bip44DerivationMappingRow>(
      db,
      tx,
      { row: mappingInsert },
      Tables.Bip44DerivationMappingSchema.name,
    );

  return {
    ...derivationResult,
    mappingTableResult,
  };
}

export async function addByLevelWithParent<Insert, Row>(
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Insert>,
  level: number,
) {
  const tableName = TableMap.get(level);
  if (tableName == null) {
    throw new Error('api::addByLevelWithParent Unknown table queried');
  }
  return await _addDerivationWithParent<Insert, Row>(
    db, tx,
    request, tableName
  );
}

export async function addByLevel<Insert, Row>(
  db: lf$Database,
  tx: lf$Transaction,
  request: AddDerivationRequest<Insert>,
  level: number,
) {
  const tableName = TableMap.get(level);
  if (tableName == null) {
    throw new Error('api::addByLevel Unknown table queried');
  }
  return await _addDerivation<Insert, Row>(
    db, tx,
    request, tableName
  );
}

export const deriveFromRoot = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Bip44PurposeInsert>,
) => (
  await _addDerivationWithParent<Bip44PurposeInsert, Bip44PurposeRow>(
    db, tx,
    request, Tables.Bip44PurposeSchema.name,
  )
);
export const deriveFromPurpose = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Bip44CoinTypeInsert>,
) => (
  await _addDerivationWithParent<Bip44CoinTypeInsert, Bip44CoinTypeRow>(
    db, tx,
    request, Tables.Bip44CoinTypeSchema.name,
  )
);
export const deriveFromCoinType = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Bip44AccountInsert>,
) => (
  await _addDerivationWithParent<Bip44AccountInsert, Bip44AccountRow>(
    db, tx,
    request, Tables.Bip44AccountSchema.name,
  )
);
export const deriveFromAccount = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Bip44ChainInsert>,
) => (
  await _addDerivationWithParent<Bip44ChainInsert, Bip44ChainRow>(
    db, tx,
    request, Tables.Bip44ChainSchema.name,
  )
);
export const deriveFromChain = async (
  db: lf$Database,
  tx: lf$Transaction,
  request: DeriveFromRequest<Bip44AddressInsert>,
) => (
  await _addDerivationWithParent<Bip44AddressInsert, Bip44AddressRow>(
    db, tx,
    request, Tables.Bip44AddressSchema.name,
  )
);
