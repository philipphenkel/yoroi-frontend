// @flow
import type { SelectedExternalStorageProvider } from '../../domain/ExternalStorage';
import environment from '../../environment';
import { unitOfAccountDisabledValue } from '../../types/unitOfAccountType';
import type { UnitOfAccountSettingType } from '../../types/unitOfAccountType';

import {
    getLocalItem,
    setLocalItem,
    removeLocalItem,
    isEmptyStorage,
} from './primitives';
import {
  TabIdKeys,
} from '../../utils/tabManager';
import type { ComplexityLevelType } from '../../types/complexityLevelType';
import type { WhitelistEntry } from '../../../chrome/extension/ergo-connector/types';
import type { CatalystRoundInfoResponse } from '../ada/lib/state-fetch/types'

const networkForLocalStorage = String(environment.getNetworkName());
const storageKeys = {
  USER_LOCALE: networkForLocalStorage + '-USER-LOCALE',
  TERMS_OF_USE_ACCEPTANCE: networkForLocalStorage + '-TERMS-OF-USE-ACCEPTANCE',
  URI_SCHEME_ACCEPTANCE: networkForLocalStorage + '-URI-SCHEME-ACCEPTANCE',
  COMPLEXITY_LEVEL: networkForLocalStorage + '-COMPLEXITY-LEVEL',
  THEME: networkForLocalStorage + '-THEME',
  CUSTOM_THEME: networkForLocalStorage + '-CUSTOM-THEME',
  VERSION: networkForLocalStorage + '-LAST-LAUNCH-VER',
  HIDE_BALANCE: networkForLocalStorage + '-HIDE-BALANCE',
  UNIT_OF_ACCOUNT: networkForLocalStorage + '-UNIT-OF-ACCOUNT',
  COIN_PRICE_PUB_KEY_DATA: networkForLocalStorage + '-COIN-PRICE-PUB-KEY-DATA',
  EXTERNAL_STORAGE: networkForLocalStorage + '-EXTERNAL-STORAGE',
  TOGGLE_SIDEBAR: networkForLocalStorage + '-TOGGLE-SIDEBAR',
  WALLETS_NAVIGATION: networkForLocalStorage + '-WALLETS-NAVIGATION',
  SUBMITTED_TRANSACTIONS: 'submittedTransactions',
  ANALYTICS_INSTANCE_ID: networkForLocalStorage + '-ANALYTICS',
  CATALYST_ROUND_INFO: networkForLocalStorage + '-CATALYST_ROUND_INFO',
  // ========== CONNECTOR   ========== //
  ERGO_CONNECTOR_WHITELIST: 'connector_whitelist',
};

export type SetCustomUserThemeRequest = {|
  cssCustomPropObject: Object,
|};

export type WalletsNavigation = {|
  ergo: number[],
  cardano: number[],
  quickAccess: number[],
|}

/**
 * This api layer provides access to the electron local storage
 * for user settings that are not synced with any coin backend.
 */

export default class LocalStorageApi {

  // ========== Locale ========== //

  getUserLocale: void => Promise<?string> = () => getLocalItem(storageKeys.USER_LOCALE);

  setUserLocale: string => Promise<void> = (
    locale
  ) => setLocalItem(storageKeys.USER_LOCALE, locale);

  unsetUserLocale: void => Promise<void> = () => removeLocalItem(storageKeys.USER_LOCALE);

  // ========== Terms of Use ========== //

  getTermsOfUseAcceptance: void => Promise<boolean> = () => getLocalItem(
    storageKeys.TERMS_OF_USE_ACCEPTANCE
  ).then((accepted) => accepted === 'true');

  setTermsOfUseAcceptance: void => Promise<void> = () => setLocalItem(
    storageKeys.TERMS_OF_USE_ACCEPTANCE, JSON.stringify(true)
  );

  unsetTermsOfUseAcceptance: void => Promise<void> = () => removeLocalItem(
    storageKeys.TERMS_OF_USE_ACCEPTANCE
  );

  // ========== URI Scheme acceptance ========== //

  getUriSchemeAcceptance: void => Promise<boolean> = () => getLocalItem(
    storageKeys.URI_SCHEME_ACCEPTANCE
  ).then((accepted) => {
    if (accepted !== 'true') return false;
    return JSON.parse(accepted);
  });

  setUriSchemeAcceptance: void => Promise<void> = () => setLocalItem(
    storageKeys.URI_SCHEME_ACCEPTANCE, JSON.stringify(true)
  );

  unsetUriSchemeAcceptance: void => Promise<void> = () => removeLocalItem(
    storageKeys.URI_SCHEME_ACCEPTANCE
  );

  // ========== Level Complexity ========== //
  getComplexityLevel: void => Promise<?ComplexityLevelType> = () => getLocalItem(
    storageKeys.COMPLEXITY_LEVEL
  ).then(level => {
    if (level == null) return null;
    return JSON.parse(level);
  })

  setComplexityLevel: ComplexityLevelType => Promise<void> = (
    level: ComplexityLevelType
  ) => setLocalItem(storageKeys.COMPLEXITY_LEVEL, JSON.stringify(level))

  unsetComplexityLevel: void => Promise<void> = () => removeLocalItem(storageKeys.COMPLEXITY_LEVEL)

  // ========== User Theme ========== //

  getUserTheme: void => Promise<?string> = () => getLocalItem(storageKeys.THEME);

  setUserTheme: string => Promise<void> = (theme) => setLocalItem(storageKeys.THEME, theme);

  unsetUserTheme: void => Promise<void> = () => removeLocalItem(storageKeys.THEME);

  // ========== Custom User Theme ========== //

  getCustomUserTheme: void => Promise<?string> = () => getLocalItem(storageKeys.CUSTOM_THEME);

  setCustomUserTheme: SetCustomUserThemeRequest => Promise<void> = ({ cssCustomPropObject }) =>
    new Promise((resolve, reject) => {
      try {
        return setLocalItem(storageKeys.CUSTOM_THEME, JSON.stringify(cssCustomPropObject));
      } catch (error) {
        return reject(error);
      }
    });

  unsetCustomUserTheme: void => Promise<void> = () => removeLocalItem(storageKeys.CUSTOM_THEME);

  // ========== Last Launch Version Number ========== //

  getLastLaunchVersion: void => Promise<string> = () => getLocalItem(
    storageKeys.VERSION
  ).then((versionNum) => {
    if (versionNum == null) return '0.0.0';
    return versionNum;
  });

  setLastLaunchVersion: string => Promise<void> = (version: string) => setLocalItem(
    storageKeys.VERSION, version
  );

  unsetLastLaunchVersion: void => Promise<void> = () => removeLocalItem(storageKeys.VERSION);

  isEmpty: void => Promise<boolean> = () => isEmptyStorage();

  clear: void => Promise<void> = async () => {
    const storage = JSON.parse(await this.getStorage());
    await Object.keys(storage).forEach(async key => {
      // changing this key would cause the tab to close
      const isTabCloseKey = new Set(Object.values(TabIdKeys)).has(key);
      if (!isTabCloseKey) {
        await removeLocalItem(key);
      }
    });
  }

  // ========== Show/hide Balance ========== //

  getHideBalance: void => Promise<boolean> = () => getLocalItem(
    storageKeys.HIDE_BALANCE
  ).then((accepted) => {
    if (accepted !== 'true') return false;
    return JSON.parse(accepted);
  });

  setHideBalance: boolean => Promise<void> = (hideBalance) => setLocalItem(
    storageKeys.HIDE_BALANCE, JSON.stringify(!hideBalance)
  );

  unsetHideBalance: void => Promise<void> = () => removeLocalItem(storageKeys.HIDE_BALANCE);

  // ========== Expand / retract Sidebar ========== //

  getToggleSidebar: void => Promise<boolean> = () => getLocalItem(
    storageKeys.TOGGLE_SIDEBAR
  ).then((accepted) => {
    if (accepted !== 'true') return false;
    return JSON.parse(accepted);
  });

  setToggleSidebar: boolean => Promise<void> = (toggleSidebar) => setLocalItem(
    storageKeys.TOGGLE_SIDEBAR, JSON.stringify(!toggleSidebar)
  );

  unsetToggleSidebar: void => Promise<void> = () => removeLocalItem(storageKeys.TOGGLE_SIDEBAR);

  // ============ External storage provider ============ //

  getExternalStorage: void => Promise<?SelectedExternalStorageProvider> = () => getLocalItem(
    storageKeys.EXTERNAL_STORAGE
  ).then((result) => {
    if (result === undefined || result === null) return null;
    return JSON.parse(result);
  });

  setExternalStorage: SelectedExternalStorageProvider => Promise<void> = (provider) => setLocalItem(
    storageKeys.EXTERNAL_STORAGE, JSON.stringify(provider)
  );

  unsetExternalStorage: void => Promise<void> = () => removeLocalItem(storageKeys.EXTERNAL_STORAGE);


  // ========== CONNECTOR whitelist  ========== //
  getWhitelist: void => Promise<?Array<WhitelistEntry>> = async () => {
    const result = await getLocalItem(storageKeys.ERGO_CONNECTOR_WHITELIST);
    if (result === undefined || result === null) return undefined;
    const filteredWhitelist = JSON.parse(result).filter(e => e.protocol != null);
    this.setWhitelist(filteredWhitelist);
    return filteredWhitelist;
  }

  setWhitelist: (Array<WhitelistEntry> | void) => Promise<void> = value =>
    setLocalItem(
      storageKeys.ERGO_CONNECTOR_WHITELIST,
      JSON.stringify(value ?? [])
    );

  // =========== Common =============== //

  // ========== Unit of account ========== //

  getUnitOfAccount: void => Promise<UnitOfAccountSettingType> = (
  ) => new Promise((resolve, reject) => {
    try {
      const unitOfAccount = localStorage.getItem(storageKeys.UNIT_OF_ACCOUNT);
      if (unitOfAccount == null) resolve(unitOfAccountDisabledValue);
      else resolve(JSON.parse(unitOfAccount));
    } catch (error) {
      return reject(error);
    }
  });

  setUnitOfAccount: UnitOfAccountSettingType => Promise<void> = (
    currency
  ) => new Promise((resolve, reject) => {
    try {
      localStorage.setItem(storageKeys.UNIT_OF_ACCOUNT, JSON.stringify(currency));
      resolve();
    } catch (error) {
      return reject(error);
    }
  });

  unsetUnitOfAccount: void => Promise<void> = () => new Promise((resolve) => {
    try {
      localStorage.removeItem(storageKeys.UNIT_OF_ACCOUNT);
    } catch (_error) {
      // ignore the error
    }
    resolve();
  });

  // ========== Coin price data public key  ========== //

  getCoinPricePubKeyData: void => Promise<?string> = async () => {
    return localStorage.getItem(storageKeys.COIN_PRICE_PUB_KEY_DATA);
  }

  setCoinPricePubKeyData: string => Promise<void> = async (pubKeyData) => {
    localStorage.setItem(storageKeys.COIN_PRICE_PUB_KEY_DATA, pubKeyData);
  }

  unsetCoinPricePubKeyData: void => Promise<void> = async () => {
    try {
      localStorage.removeItem(storageKeys.COIN_PRICE_PUB_KEY_DATA);
    } catch (_) {
      // ignore the error
    }
  }


  // ========== Sort wallets - Revamp ========== //
  getWalletsNavigation: void => Promise<?WalletsNavigation> = async () => {
    let result = await getLocalItem(storageKeys.WALLETS_NAVIGATION);
    if (result === undefined || result === null) return undefined;
    result = JSON.parse(result);
    // Added for backward compatibility
    if(Array.isArray(result)) return {
      cardano: [],
      ergo: [],
      quickAccess: [],
    }

    return result
  };

  setWalletsNavigation: (WalletsNavigation) => Promise<void> = value =>
    setLocalItem(storageKeys.WALLETS_NAVIGATION, JSON.stringify(value));

  async reset(): Promise<void> {
    await this.unsetUserLocale();
    await this.unsetTermsOfUseAcceptance();
    await this.unsetUserTheme();
    await this.unsetComplexityLevel();
    await this.unsetLastLaunchVersion();
    await this.unsetHideBalance();
    await this.unsetUnitOfAccount();
    await this.unsetCoinPricePubKeyData();
    await this.unsetExternalStorage();
    await this.unsetToggleSidebar();
  }

  getItem: string => Promise<?string> = (key) => getLocalItem(key);

  setItem: (string, string) => Promise<void> = (key, value) => setLocalItem(key, value);

  getOldStorage: void => Promise<Storage> = () => new Promise((resolve) => {
    resolve(localStorage);
  });

  setStorage: { [key: string]: string, ... } => Promise<void> = async (localStorageData) => {
    await Object.keys(localStorageData).forEach(async key => {
      // changing this key would cause the tab to close
      const isTabCloseKey = new Set(Object.values(TabIdKeys)).has(key);
      if (!isTabCloseKey) {
        await setLocalItem(key, localStorageData[key]);
      }
    });
  };

  getStorage: void => Promise<string> = () => {
    return getLocalItem(undefined).then(json => {
      if (json == null) {
        return '{}';
      }
      return json;
    });
  };

}

export type PersistedSubmittedTransaction = {|
  publicDeriverId: number,
  networkId: number,
  transaction: Object,
  usedUtxos: Array<{|
    txHash: string,
    index: number,
  |}>,
|};

export function persistSubmittedTransactions(
  submittedTransactions: any,
): void {
  localStorage.setItem(
    storageKeys.SUBMITTED_TRANSACTIONS,
    JSON.stringify(submittedTransactions)
  );
}

export function loadSubmittedTransactions(): any {
  const dataStr = localStorage.getItem(storageKeys.SUBMITTED_TRANSACTIONS);
  if (dataStr == null) {
    return null;
  }
  return JSON.parse(dataStr);
}

export async function loadAnalyticsInstanceId(): Promise<?string> {
  return getLocalItem(storageKeys.ANALYTICS_INSTANCE_ID);
}

export async function saveAnalyticsInstanceId(id: string): Promise<void> {
  await setLocalItem(storageKeys.ANALYTICS_INSTANCE_ID, id);
}

export async function loadCatalystRoundInfo(): Promise<?CatalystRoundInfoResponse> {
  const json = await getLocalItem(storageKeys.CATALYST_ROUND_INFO);
  if (!json) {
    return undefined;
  }
  return JSON.parse(json);
}

export async function saveCatalystRoundInfo(data: CatalystRoundInfoResponse): Promise<void> {
  await setLocalItem(storageKeys.CATALYST_ROUND_INFO, JSON.stringify(data));
}
