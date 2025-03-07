// @flow

import BigNumber from 'bignumber.js';
import type {
  HistoryRequest, HistoryResponse, HistoryFunc,
  BestBlockRequest, BestBlockResponse, BestBlockFunc,
  AddressUtxoRequest, AddressUtxoResponse, AddressUtxoFunc,
  UtxoSumRequest, UtxoSumResponse, UtxoSumFunc,
  RewardHistoryFunc,
  AccountStateRequest, AccountStateResponse, AccountStateFunc,
  PoolInfoRequest, PoolInfoResponse, PoolInfoFunc,
  RemoteTransaction, RemoteUnspentOutput,
  SignedRequestInternal,
  RemoteTransactionInput,
  TokenInfoFunc,
  MultiAssetMintMetadataFunc
} from './types';
import type {
  FilterUsedRequest, FilterUsedResponse, FilterFunc,
} from '../../../common/lib/state-fetch/currencySpecificTypes';
import { RollbackApiError, } from '../../../common/errors';
import { toEnterprise, addressToKind, toHexOrBase58, } from '../storage/bridge/utils';
import { CoreAddressTypes } from '../storage/database/primitives/enums';
import type { CoreAddressT } from '../storage/database/primitives/enums';
import {
  mnemonicToEntropy
} from 'bip39';
import {
  WalletTypePurpose,
} from '../../../../config/numbersConfig';
import type { NetworkRow } from '../storage/database/primitives/tables';

import { RustModule } from '../cardanoCrypto/rustLoader';

import { generateLedgerWalletRootKey } from '../cardanoCrypto/cryptoWallet';
import { networks, getCardanoHaskellBaseConfig } from '../storage/database/prepackaged/networks';
import { bech32 } from 'bech32';
import { Bech32Prefix } from '../../../../config/stringConfig';
import { parseTokenList } from '../../transactions/utils';

/** convert bech32 address to bytes */
function fixAddresses(
  address: string,
  network: $ReadOnly<NetworkRow>,
): string {
  try {
    const bech32Info = bech32.decode(address, 1000);
    if (bech32Info.prefix === Bech32Prefix.PAYMENT_KEY_HASH) {
      const config = getCardanoHaskellBaseConfig(
        network
      ).reduce((acc, next) => Object.assign(acc, next), {});

      const enterpriseAddr = RustModule.WalletV4.EnterpriseAddress.new(
        Number.parseInt(config.ChainNetworkId, 10),
        RustModule.WalletV4.StakeCredential.from_keyhash(
          RustModule.WalletV4.Ed25519KeyHash.from_bech32(address)
        )
      );
      return Buffer.from(enterpriseAddr.to_address().to_bytes()).toString('hex');
    }
    const payload = bech32.fromWords(bech32Info.words);
    return Buffer.from(payload).toString('hex');
  } catch (_e) {
    return address;
  }
}
export function genCheckAddressesInUse(
  blockchain: Array<RemoteTransaction>,
  network: $ReadOnly<NetworkRow>,
): FilterFunc {
  return async (
    body: FilterUsedRequest,
  ): Promise<FilterUsedResponse> => {
    const addresses = body.addresses.map(addr => fixAddresses(addr, network));
    const addressSet = new Set(addresses);
    const usedSet = new Set();

    for (const tx of blockchain) {
      if (tx.tx_state !== 'Successful') {
        continue;
      }
      const oursInTx = ourAddressesInTx(tx, addressSet);
      for (const found of oursInTx) {
        usedSet.add(found);
      }
    }

    return Array.from(usedSet);
  };
}

function isOurAddress(
  address: string,
  ownAddresses: Set<string>,
): boolean {
  if (ownAddresses.has(address)) {
    return true;
  }
  const enterpriseWasm = toEnterprise(address);
  if (enterpriseWasm != null) {
    const enterprise = Buffer.from(enterpriseWasm.to_address().to_bytes()).toString('hex');
    if (ownAddresses.has(enterprise)) {
      return true;
    }
  }
  return false;
}

function ourAddressesInTx(
  tx: RemoteTransaction,
  ownAddresses: Set<string>,
): Set<string> {
  const addresses = [
    ...tx.inputs.map(input => input.address),
    ...tx.outputs.map(output => output.address),
  ];
  if (tx.type === 'shelley') {
    addresses.push(...tx.withdrawals.map(withdrawal => withdrawal.address));
  }
  const addressesUsed = new Set();
  for (const addr of addresses) {
    if (isOurAddress(addr, ownAddresses)) {
      addressesUsed.add(addr);
    }
  }
  return addressesUsed;
}

function filterForOwn(
  txs: Array<RemoteTransaction>,
  ownAddresses: Set<string>,
  _network: $ReadOnly<NetworkRow>,
): Array<RemoteTransaction> {
  const ownTxs = [];
  for (const tx of txs) {
    const oursInTx = ourAddressesInTx(tx, ownAddresses);
    if (oursInTx.size > 0) {
      ownTxs.push(tx);
    }
  }
  return ownTxs;
}

export function genGetTransactionsHistoryForAddresses(
  blockchain: Array<RemoteTransaction>,
  network: $ReadOnly<NetworkRow>,
): HistoryFunc {
  return async (
    body: HistoryRequest,
  ): Promise<HistoryResponse> => {
    const addresses = body.addresses.map(addr => fixAddresses(addr, network));
    const untilBlockIndex = blockchain.map(tx => tx.block_hash).lastIndexOf(body.untilBlock);
    if (untilBlockIndex === -1) {
      throw new RollbackApiError();
    }
    const subChain = blockchain.slice(0, untilBlockIndex + 1);
    // need to add back all pending/failed txs
    for (let i = untilBlockIndex + 1; i < blockchain.length; i++) {
      if (blockchain[i].block_hash == null) {
        subChain.push(blockchain[i]);
      }
    }
    const ownAddresses = new Set(addresses);
    if (body.after == null)  {
      const filtered = filterForOwn(subChain, ownAddresses, network);
      return filtered;
    }
    const after = body.after;

    let cutoffTx = undefined;
    for (let i = 0; i < subChain.length; i++) {
      if (
        subChain[i].hash === after.tx &&
        subChain[i].block_hash === after.block
      ) {
        cutoffTx = subChain[i];
        break;
      }
    }
    if (cutoffTx == null) {
      throw new RollbackApiError();
    }
    if (cutoffTx.height == null || cutoffTx.tx_ordinal == null) {
      throw new Error(`${nameof(genGetTransactionsHistoryForAddresses)} cutoffTx not in block - should never happen`);
    }
    const cutoffBlockNum = cutoffTx.height;
    const cutoffOrdinal = cutoffTx.tx_ordinal;

    const txsToInclude: Array<RemoteTransaction> = [];
    for (const tx of subChain) {
      if (tx === cutoffTx) continue;
      if (tx.height == null || tx.tx_ordinal == null) {
        txsToInclude.push(tx);
        continue;
      } else {
        const blockNum = tx.height;
        const ordinal = tx.tx_ordinal;
        if (blockNum > cutoffBlockNum) {
          txsToInclude.push(tx);
        } else if (blockNum === cutoffBlockNum) {
          if (ordinal > cutoffOrdinal) {
            txsToInclude.push(tx);
          }
        }
      }
    }
    const filtered = filterForOwn(txsToInclude, ownAddresses, network);
    return filtered;
  };
}

export function genGetBestBlock(
  blockchain: Array<RemoteTransaction>,
): BestBlockFunc {
  return async (
    _body: BestBlockRequest,
  ): Promise<BestBlockResponse> => {
    let bestInNetwork: void | BestBlockResponse = undefined;
    for (let i = blockchain.length - 1; i >= 0; i--) {
      const block = blockchain[i];
      if (
        block.height != null &&
        block.epoch != null &&
        block.slot != null &&
        block.block_hash != null
      ) {
        bestInNetwork = {
          epoch: block.epoch,
          slot: block.slot,
          hash: block.block_hash,
          height: block.height,
        };
        break;
      }
    }
    if (bestInNetwork == null) {
      return {
        height: 0,
        epoch: null,
        slot: null,
        hash: null,
      };
    }
    return bestInNetwork;
  };
}

export function genUtxoForAddresses(
  getHistory: HistoryFunc,
  getBestBlock: BestBlockFunc,
  network: $ReadOnly<NetworkRow>,
): AddressUtxoFunc {
  return async (
    body: AddressUtxoRequest,
  ): Promise<AddressUtxoResponse> => {
    const addresses = body.addresses.map(addr => fixAddresses(addr, network));
    const bestBlock = await getBestBlock({
      network,
    });
    if (bestBlock.hash == null) {
      return [];
    }
    const until = bestBlock.hash;
    const history = await getHistory({
      network,
      addresses,
      untilBlock: until,
    });
    const inBlockHistory = history.filter(tx => tx.block_hash != null);
    const ourAddressSet = new Set(addresses);

    const utxoMap = new Map<string, RemoteUnspentOutput>();
    for (const tx of inBlockHistory) {
      for (let j = 0; j < tx.outputs.length; j++) {
        const address = tx.outputs[j].address;
        if (isOurAddress(address, ourAddressSet)) {
          const kind = addressToKind(address, 'bytes', networks.CardanoMainnet);
          if (
            kind === CoreAddressTypes.CARDANO_REWARD
          ) {
            throw new Error(`${nameof(genUtxoForAddresses)} non-utxo address in utxo endpoint`);
          }
          const key = JSON.stringify({
            id: tx.hash,
            index: j
          });
          utxoMap.set(key, {
            utxo_id: tx.hash + j,
            tx_hash: tx.hash,
            tx_index: j,
            receiver: tx.outputs[j].address,
            amount: tx.outputs[j].amount.toString(),
            assets: tx.outputs[j].assets,
          });
        }
      }
    }
    for (const tx of inBlockHistory) {
      for (let j = 0; j < tx.inputs.length; j++) {
        const input = tx.inputs[j];
        const key = JSON.stringify({
          id: input.txHash,
          index: input.index,
        });
        utxoMap.delete(key);
      }
    }
    const result = Array.from(utxoMap.values());
    return result;
  };
}

export function genUtxoSumForAddresses(
  getAddressUtxo: AddressUtxoFunc,
): UtxoSumFunc {
  return async (
    body: UtxoSumRequest,
  ): Promise<UtxoSumResponse> => {
    const utxos = await getAddressUtxo(body);
    if (utxos.length === 0) {
      return {
        sum: null,
        assets: [],
      };
    }
    // sum all chunks together
    let sum: BigNumber = new BigNumber(0);
    const assetMap = new Map<string, ReadonlyElementOf<$PropertyType<UtxoSumResponse, 'assets'>>>();
    for (const partial of utxos) {
      sum = sum.plus(new BigNumber(partial.amount));
      for (const asset of partial.assets) {
        const currentVal = assetMap.get(asset.assetId)?.amount ?? new BigNumber(0);
        assetMap.set(
          asset.assetId,
          {
            ...asset,
            amount: new BigNumber(currentVal).plus(asset.amount).toString(),
          },
        );
      }
    }
    return {
      sum: sum.toString(),
      assets: Array.from(assetMap.entries()).map(entry => ({
        ...entry[1],
      })),
    };
  };
}

export function getSingleAddressString(
  mnemonic: string,
  path: Array<number>,
  isLedger?: boolean = false,
): string {
  const bip39entropy = mnemonicToEntropy(mnemonic);
  const EMPTY_PASSWORD = Buffer.from('');
  const rootKey = isLedger
    ? generateLedgerWalletRootKey(mnemonic)
    : RustModule.WalletV4.Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(bip39entropy, 'hex'),
      EMPTY_PASSWORD
    );
  const derivedKey = derivePath(rootKey, path);

  const baseConfig = getCardanoHaskellBaseConfig(networks.CardanoMainnet)
    .reduce((acc, next) => Object.assign(acc, next), {});

  if (path[0] === WalletTypePurpose.BIP44) {
    const v2Key = RustModule.WalletV2.PublicKey.from_hex(
      Buffer.from(derivedKey.to_public().as_bytes()).toString('hex')
    );
    const settings = RustModule.WalletV2.BlockchainSettings.from_json({
      protocol_magic: baseConfig.ByronNetworkId,
    });
    const addr = v2Key.bootstrap_era_address(settings);
    const hex = addr.to_base58();
    return hex;
  }
  if (path[0] === WalletTypePurpose.CIP1852) {
    const addr = RustModule.WalletV4.EnterpriseAddress.new(
      Number.parseInt(baseConfig.ChainNetworkId, 10),
      RustModule.WalletV4.StakeCredential.from_keyhash(
        derivedKey.to_public().to_raw_key().hash()
      ),
    );
    return Buffer.from(addr.to_address().to_bytes()).toString('hex');
  }
  throw new Error('Unexpected purpose');
}

export function getMangledAddressString(
  mnemonic: string,
  path: Array<number>,
  stakingKey: Buffer,
  isLedger?: boolean = false,
): string {
  const bip39entropy = mnemonicToEntropy(mnemonic);
  const EMPTY_PASSWORD = Buffer.from('');
  const rootKey = isLedger
    ? generateLedgerWalletRootKey(mnemonic)
    : RustModule.WalletV4.Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(bip39entropy, 'hex'),
      EMPTY_PASSWORD
    );
  const derivedKey = derivePath(rootKey, path);

  const baseConfig = getCardanoHaskellBaseConfig(networks.CardanoMainnet)
    .reduce((acc, next) => Object.assign(acc, next), {});

  if (path[0] === WalletTypePurpose.CIP1852) {
    const addr = RustModule.WalletV4.BaseAddress.new(
      Number.parseInt(baseConfig.ChainNetworkId, 10),
      RustModule.WalletV4.StakeCredential.from_keyhash(
        derivedKey.to_public().to_raw_key().hash()
      ),
      RustModule.WalletV4.StakeCredential.from_keyhash(
        RustModule.WalletV4.Ed25519KeyHash.from_bytes(
          stakingKey
        )
      )
    );
    return Buffer.from(addr.to_address().to_bytes()).toString('hex');
  }
  throw new Error('Unexpected purpose');
}

export function getAddressForType(
  mnemonic: string,
  path: Array<number>,
  type: CoreAddressT,
): string {
  const bip39entropy = mnemonicToEntropy(mnemonic);
  const EMPTY_PASSWORD = Buffer.from('');
  const rootKey = RustModule.WalletV4.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(bip39entropy, 'hex'),
    EMPTY_PASSWORD
  );
  const derivedKey = derivePath(rootKey, path);

  const baseConfig = getCardanoHaskellBaseConfig(networks.CardanoMainnet)
    .reduce((acc, next) => Object.assign(acc, next), {});

  switch (type) {
    case CoreAddressTypes.CARDANO_BASE: {
      const newPath = [...path];
      // -1 because newPath here starts at PURPOSE and not at ROOT
      const chainLevel = 4 - 1;
      const addressLevel = 5 - 1;
      newPath[chainLevel] = 2;
      newPath[addressLevel] = 0;
      const stakingKey = derivePath(rootKey, newPath);
      const addr = RustModule.WalletV4.BaseAddress.new(
        Number.parseInt(baseConfig.ChainNetworkId, 10),
        RustModule.WalletV4.StakeCredential.from_keyhash(
          derivedKey.to_public().to_raw_key().hash()
        ),
        RustModule.WalletV4.StakeCredential.from_keyhash(
          stakingKey.to_public().to_raw_key().hash()
        ),
      );
      return Buffer.from(addr.to_address().to_bytes()).toString('hex');
    }
    case CoreAddressTypes.CARDANO_PTR: {
      throw new Error(`${nameof(getAddressForType)} Not implemented`);
    }
    case CoreAddressTypes.CARDANO_ENTERPRISE: {
      const addr = RustModule.WalletV4.EnterpriseAddress.new(
        Number.parseInt(baseConfig.ChainNetworkId, 10),
        RustModule.WalletV4.StakeCredential.from_keyhash(
          derivedKey.to_public().to_raw_key().hash()
        ),
      );
      return Buffer.from(addr.to_address().to_bytes()).toString('hex');
    }
    case CoreAddressTypes.CARDANO_REWARD: {
      const addr = RustModule.WalletV4.RewardAddress.new(
        Number.parseInt(baseConfig.ChainNetworkId, 10),
        RustModule.WalletV4.StakeCredential.from_keyhash(
          derivedKey.to_public().to_raw_key().hash()
        ),
      );
      return Buffer.from(addr.to_address().to_bytes()).toString('hex');
    }
    default: throw new Error(`${nameof(getAddressForType)} unknown type ` + type);
  }
}

function derivePath(
  startKey: RustModule.WalletV4.Bip32PrivateKey,
  path: Array<number>
): RustModule.WalletV4.Bip32PrivateKey {
  let currKey = startKey;
  for (let i = 0; i < path.length; i++) {
    currKey = currKey.derive(path[i]);
  }
  return currKey;
}

function getByronInputs(
  blockchain: Array<RemoteTransaction>,
  inputs: Array<TxoPointerType>
): Array<RemoteTransactionInput> {
  const result: Array<RemoteTransactionInput> = [];
  for (const input of inputs) {
    const pointedTx = blockchain.find(tx => tx.hash === input.id);
    if (pointedTx == null) {
      throw new Error(`${nameof(getByronInputs)} no tx found ${input.id}`);
    }
    const pointedOutput = pointedTx.outputs[input.index];
    const addressKind = addressToKind(pointedOutput.address, 'bytes', networks.CardanoMainnet);
    if (
      addressKind === CoreAddressTypes.CARDANO_LEGACY ||
      addressKind === CoreAddressTypes.CARDANO_BASE ||
      addressKind === CoreAddressTypes.CARDANO_ENTERPRISE ||
      addressKind === CoreAddressTypes.CARDANO_PTR
    ) {
      result.push({
        address: pointedOutput.address,
        amount: pointedOutput.amount,
        id: input.id + input.index,
        index: input.index,
        txHash: input.id,
        assets: pointedOutput.assets,
      });
    } else {
      throw new Error(`${nameof(getByronInputs)} unexpected type ${addressKind}`);
    }
  }
  return result;
}

export function toRemoteByronTx(
  blockchain: Array<RemoteTransaction>,
  request: SignedRequestInternal,
): RemoteTransaction {
  const signedTx = RustModule.WalletV4.Transaction
    .from_bytes(Buffer.from(request.signedTx, 'base64'));

  const body = signedTx.body();
  const hash = Buffer.from(RustModule.WalletV4.hash_transaction(body).to_bytes()).toString('hex');

  const wasmOutputs = body.outputs();
  const outputs = [];
  for (let i = 0; i < wasmOutputs.len(); i++) {
    const output = wasmOutputs.get(i);
    const value = output.amount();

    const assets = parseTokenList(value.multiasset());

    outputs.push({
      address: toHexOrBase58(output.address()),
      amount: value.coin().to_str(),
      assets
    });
  }

  const wasmInputs = body.inputs();
  const inputs = [];
  for (let i = 0; i < wasmInputs.len(); i++) {
    const input = wasmInputs.get(i);

    inputs.push({
      id: Buffer.from(input.transaction_id().to_bytes()).toString('hex'),
      index: input.index(),
    });
  }
  const base = {
    hash,
    last_update: new Date().toString(),
    tx_state: 'Pending',
    inputs: getByronInputs(blockchain, inputs),
    outputs,
  };

  return {
    ...base,
    height: null,
    block_hash: null,
    tx_ordinal: null,
    time: null,
    epoch: null,
    slot: null,
  };
}

export function genGetAccountState(
  blockchain: Array<RemoteTransaction>,
  getRewardHistory: RewardHistoryFunc,
): AccountStateFunc {
  return async (
    body: AccountStateRequest,
  ): Promise<AccountStateResponse> => {
    const rewardHistory = await getRewardHistory(body);

    // 1) calculate the reward for each address
    const resultMap = new Map<string, {|
      rewards: BigNumber,
      withdrawals: BigNumber,
    |}>();
    for (const key of Object.keys(rewardHistory)) {
      for (const reward of (rewardHistory[key] ?? [])) {
        const currVal = resultMap.get(key) ?? {
          rewards: new BigNumber(0),
          withdrawals: new BigNumber(0),
        };

        currVal.rewards = currVal.rewards.plus(reward.reward);
      }
    }

    const addressSet = new Set(body.addresses);
    // 2) calculate the withdrawal for each address
    for (const tx of blockchain) {
      if (tx.type !== 'shelley') continue;
      for (const withdrawal of tx.withdrawals) {
        if (addressSet.has(withdrawal.address)) {
          const currVal = resultMap.get(withdrawal.address) ?? {
            rewards: new BigNumber(0),
            withdrawals: new BigNumber(0),
          };

          currVal.withdrawals = currVal.withdrawals.plus(withdrawal.amount);
        }
      }
    }

    // 3) gather up the result

    const result: AccountStateResponse = {};
    for (const address of body.addresses) {
      const stateForAddr = resultMap.get(address) ?? {
        rewards: new BigNumber(0),
        withdrawals: new BigNumber(0),
      };
      result[address] = {
        poolOperator: null, // TODO
        remainingAmount: stateForAddr.rewards.minus(stateForAddr.withdrawals).toString(),
        rewards: stateForAddr.rewards.toString(),
        withdrawals: stateForAddr.withdrawals.toString(),
      };
    }
    return result;
  };
}

export function genGetPoolInfo(
): PoolInfoFunc {
  return async (
    body: PoolInfoRequest,
  ): Promise<PoolInfoResponse> => {
    // TODO: scan the chain properly for this information
    const mockPoolId = 'df1750df9b2df285fcfb50f4740657a18ee3af42727d410c37b86207';
    const result: PoolInfoResponse = {};
    for (const poolId of body.poolIds) {
      if (poolId === mockPoolId) {
        result[mockPoolId] = {
          info: {
            name: 'Yoroi',
            description: 'Yoroi is a light wallet for Cardano. It’s simple, fast and secure.',
            ticker: 'YOROI',
            homepage: 'https://yoroi-wallet.com/',
          },
          history: [],
        };
      }
    }
    return result;
  };
}

export function genGetTokenInfo(
): TokenInfoFunc {
  return async (_) => ({});
}

export function genGetMultiAssetMetadata(
): MultiAssetMintMetadataFunc {
  return async (_) => ({});
}
