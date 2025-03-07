// @flow
import { action, observable, computed, runInAction } from 'mobx';
import BigNumber from 'bignumber.js';
import moment from 'moment/moment';
import Store from './Store';
import Request from '../lib/LocalizedRequest';
import environment from '../../environment';
import { THEMES } from '../../styles/utils';
import type { Theme } from '../../styles/utils';
import { LANGUAGES } from '../../i18n/translations';
import type { LanguageType } from '../../i18n/translations';
import type { SetCustomUserThemeRequest } from '../../api/localStorage/index';
import { unitOfAccountDisabledValue } from '../../types/unitOfAccountType';
import type { UnitOfAccountSettingType } from '../../types/unitOfAccountType';
import { SUPPORTED_CURRENCIES } from '../../config/unitOfAccount';
import type { ComplexityLevelType } from '../../types/complexityLevelType';
import BaseProfileActions from '../../actions/base/base-profile-actions';
import {
  trackSetLocale,
  trackUpdateTheme
} from '../../api/analytics';

interface CoinPriceStore {
  refreshCurrentUnit: Request<void => Promise<void>>
}

export default class BaseProfileStore
  <
    TStores: { +coinPriceStore: CoinPriceStore, ... },
    TActions: { +profile: BaseProfileActions, ... }
  >
  extends Store<TStores, TActions>
{

  LANGUAGE_OPTIONS: Array<LanguageType> = [
    ...LANGUAGES,
    ...(!environment.isProduction()
      ? [
          // add any language that's mid-translation here
        ]
      : []),
  ];

  UNIT_OF_ACCOUNT_OPTIONS: typeof SUPPORTED_CURRENCIES = SUPPORTED_CURRENCIES;

  /**
   * Need to store the selected language in-memory for when the user
   * is at the language select screen. Only commit to storage once the user accepts.
   */
  @observable
  inMemoryLanguage: null | string = null;

  @observable
  acceptedNightly: boolean = false;

  @observable bigNumberDecimalFormat: {|
    decimalSeparator: string,
    groupSeparator: string,
    groupSize: number,
    secondaryGroupSize: number,
    fractionGroupSeparator: string,
    fractionGroupSize: number,
  |} = {
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0,
  };

  @observable getProfileLocaleRequest: Request<(void) => Promise<?string>> = new Request<
    (void) => Promise<?string>
  >(this.api.localStorage.getUserLocale);

  @observable setProfileLocaleRequest: Request<(string) => Promise<void>> = new Request<
    (string) => Promise<void>
  >(this.api.localStorage.setUserLocale);

  @observable unsetProfileLocaleRequest: Request<(void) => Promise<void>> = new Request<
    (void) => Promise<void>
  >(this.api.localStorage.unsetUserLocale);

  @observable getThemeRequest: Request<(void) => Promise<?string>> = new Request<
    (void) => Promise<?string>
  >(this.api.localStorage.getUserTheme);

  @observable setThemeRequest: Request<(string) => Promise<void>> = new Request<
    (string) => Promise<void>
  >(this.api.localStorage.setUserTheme);

  @observable getCustomThemeRequest: Request<(void) => Promise<?string>> = new Request<
    (void) => Promise<?string>
  >(this.api.localStorage.getCustomUserTheme);

  @observable setCustomThemeRequest: Request<
    (SetCustomUserThemeRequest) => Promise<void>
  > = new Request<(SetCustomUserThemeRequest) => Promise<void>>(
    this.api.localStorage.setCustomUserTheme
  );

  @observable unsetCustomThemeRequest: Request<(void) => Promise<void>> = new Request<
    (void) => Promise<void>
  >(this.api.localStorage.unsetCustomUserTheme);

  @observable getComplexityLevelRequest: Request<
    (void) => Promise<?ComplexityLevelType>
  > = new Request<(void) => Promise<?ComplexityLevelType>>(
    this.api.localStorage.getComplexityLevel
  );

  @observable getTermsOfUseAcceptanceRequest: Request<(void) => Promise<boolean>> = new Request<
    (void) => Promise<boolean>
  >(this.api.localStorage.getTermsOfUseAcceptance);

  @observable setComplexityLevelRequest: Request<
    (ComplexityLevelType) => Promise<void>
  > = new Request<(ComplexityLevelType) => Promise<void>>(this.api.localStorage.setComplexityLevel);

  @observable unsetComplexityLevelRequest: Request<(void) => Promise<void>> = new Request<
    (void) => Promise<void>
  >(this.api.localStorage.unsetComplexityLevel);

  @observable getLastLaunchVersionRequest: Request<(void) => Promise<string>> = new Request<
    (void) => Promise<string>
  >(this.api.localStorage.getLastLaunchVersion);

  @observable setLastLaunchVersionRequest: Request<(string) => Promise<void>> = new Request<
    (string) => Promise<void>
  >(this.api.localStorage.setLastLaunchVersion);

  @observable getHideBalanceRequest: Request<(void) => Promise<boolean>> = new Request<
    (void) => Promise<boolean>
  >(this.api.localStorage.getHideBalance);

  @observable setHideBalanceRequest: Request<(boolean) => Promise<void>> = new Request<
    (boolean) => Promise<void>
  >(this.api.localStorage.setHideBalance);

  @observable setUnitOfAccountRequest: Request<
    (UnitOfAccountSettingType) => Promise<void>
  > = new Request(this.api.localStorage.setUnitOfAccount);

  @observable getUnitOfAccountRequest: Request<
    (void) => Promise<UnitOfAccountSettingType>
  > = new Request(this.api.localStorage.getUnitOfAccount);


  setup(): void {
    super.setup();
    this.actions.profile.updateLocale.listen(this._updateLocale);
    this.actions.profile.resetLocale.listen(this._resetLocale);
    this.actions.profile.updateTentativeLocale.listen(this._updateTentativeLocale);
    this.actions.profile.selectComplexityLevel.listen(this._selectComplexityLevel);
    this.actions.profile.updateTheme.listen(this._updateTheme);
    this.actions.profile.exportTheme.listen(this._exportTheme);
    this.actions.profile.commitLocaleToStorage.listen(this._acceptLocale);
    this.actions.profile.updateHideBalance.listen(this._updateHideBalance);
    this.actions.profile.updateUnitOfAccount.listen(this._updateUnitOfAccount);
    this.actions.profile.acceptNightly.listen(this._acceptNightly);
    this.registerReactions([
      this._setBigNumberFormat,
      this._updateMomentJsLocaleAfterLocaleChange,
    ]);
    this._getSelectComplexityLevel(); // eagerly cache
    this.currentTheme; // eagerly cache (note: don't remove -- getter is stateful)
  }

  teardown(): void {
    super.teardown();
  }

  _setBigNumberFormat: void => void = () => {
    BigNumber.config({
      EXPONENTIAL_AT: (1e9: any),
      FORMAT: this.bigNumberDecimalFormat,
    });
  };

  static getDefaultLocale(): string {
    return 'en-US';
  }

  // ========== Locale ========== //

  @computed get currentLocale(): string {
    // allow to override the language shown to allow user to pick a language during first app start
    if (this.inMemoryLanguage !== null) {
      return this.inMemoryLanguage;
    }
    let { result } = this.getProfileLocaleRequest;
    if (result == null) {
      result = this.getProfileLocaleRequest.execute().result;
    }
    if (this.isCurrentLocaleSet && result != null && result !== '') return result;

    return BaseProfileStore.getDefaultLocale();
  }

  @computed get hasLoadedCurrentLocale(): boolean {
    return this.getProfileLocaleRequest.wasExecuted && this.getProfileLocaleRequest.result !== null;
  }

  @computed get isCurrentLocaleSet(): boolean {
    return (
      this.getProfileLocaleRequest.result !== null &&
      this.getProfileLocaleRequest.result !== undefined
    );
  }

  @action
  _updateTentativeLocale: ({| locale: string |}) => void = request => {
    this.inMemoryLanguage = request.locale;
  };

  _updateLocale: ({| locale: string |}) => Promise<void> = async ({ locale }) => {
    await this.setProfileLocaleRequest.execute(locale);
    await this.getProfileLocaleRequest.execute(); // eagerly cache
  };

  _resetLocale: void => Promise<void> = async () => {
    await this.unsetProfileLocaleRequest.execute();
    await this.getProfileLocaleRequest.execute();
  };

  _acceptLocale: void => Promise<void> = async () => {
    // commit in-memory language to storage
    const locale = this.inMemoryLanguage != null ?
          this.inMemoryLanguage :
          BaseProfileStore.getDefaultLocale();
    await this.setProfileLocaleRequest.execute(locale);
    await this.getProfileLocaleRequest.execute(); // eagerly cache
    runInAction(() => {
      this.inMemoryLanguage = null;
    });
    trackSetLocale(locale);
  };

  _updateMomentJsLocaleAfterLocaleChange: void => void = () => {
    moment.locale(this._convertLocaleKeyToMomentJSLocalKey(this.currentLocale));
    // moment.relativeTimeThreshold('ss', -1);
  };

  _convertLocaleKeyToMomentJSLocalKey: string => string = localeKey => {
    // REF -> https://github.com/moment/moment/tree/develop/locale
    let momentJSLocalKey;
    switch (localeKey) {
      case 'zh-Hans':
        momentJSLocalKey = 'zh-cn';
        break;
      case 'zh-Hant':
        momentJSLocalKey = 'zh-tw';
        break;
      default:
        momentJSLocalKey = localeKey;
        break;
    }
    return momentJSLocalKey;
  };

  // ========== Current/Custom Theme ========== //

  @computed get currentTheme(): Theme {
    let { result } = this.getThemeRequest;
    if (result == null) {
      result = this.getThemeRequest.execute().result;
    }
    if (this.isCurrentThemeSet && result != null) {
      // verify content is an actual theme
      if (Object.values(THEMES).find(theme => theme === result)) {
        // $FlowExpectedError[incompatible-return]: can safely cast
        return result;
      }
    }

    return THEMES.YOROI_MODERN;
  }

  @computed get isModernTheme(): boolean {
    return this.currentTheme === THEMES.YOROI_MODERN;
  }

  @computed get isClassicTheme(): boolean {
    return this.currentTheme === THEMES.YOROI_CLASSIC;
  }

  /* @Returns Merged Pre-Built Theme and Custom Theme */
  @computed get currentThemeVars(): { [key: string]: string, ... } {
    let { result } = this.getCustomThemeRequest;
    if (result == null) {
      result = this.getCustomThemeRequest.execute().result;
    }
    let customThemeVars = {};
    if (result != null) {
      customThemeVars = JSON.parse(result);
    }
    // Merge Custom Theme
    return customThemeVars;
  }

  @computed get isCurrentThemeSet(): boolean {
    return this.getThemeRequest.result !== null && this.getThemeRequest.result !== undefined;
  }

  @computed get hasLoadedCurrentTheme(): boolean {
    return this.getThemeRequest.wasExecuted && this.getThemeRequest.result !== null;
  }

  _updateTheme: ({| theme: string |}) => Promise<void> = async ({ theme }) => {
    // Unset / Clear the Customized Theme from LocalStorage
    document.documentElement?.removeAttribute('style') // remove css prop
    await this.unsetCustomThemeRequest.execute();
    await this.getCustomThemeRequest.execute(); // eagerly cache
    await this.setThemeRequest.execute(theme);
    await this.getThemeRequest.execute(); // eagerly cache
    trackUpdateTheme(theme);
  };



  _exportTheme: void => Promise<void> = async () => {
    const { getCSSCustomPropObject } = require(`../../styles/utils`);
    const cssCustomPropObject = getCSSCustomPropObject();
    await this.unsetCustomThemeRequest.execute();
    await this.setCustomThemeRequest.execute({
      cssCustomPropObject
    });
    await this.getCustomThemeRequest.execute(); // eagerly cache
  };

  hasCustomTheme: void => boolean = (): boolean => {
    let { result } = this.getCustomThemeRequest;
    if (result == null) {
      result = this.getCustomThemeRequest.execute().result;
    }
    return result !== undefined;
  };

  // ========== Terms of Use ========== //

  @computed get termsOfUse(): string {
    return getTermsOfUse('ada', this.currentLocale);
  }

  @computed get hasLoadedTermsOfUseAcceptance(): boolean {
    return (
      this.getTermsOfUseAcceptanceRequest.wasExecuted &&
      this.getTermsOfUseAcceptanceRequest.result !== null
    );
  }

  @computed get areTermsOfUseAccepted(): boolean {
    return this.getTermsOfUseAcceptanceRequest.result === true;
  }

  _getTermsOfUseAcceptance: void => void = () => {
    this.getTermsOfUseAcceptanceRequest.execute();
  };


  // ========== Complexity Level Choice ========== //

  @computed get selectedComplexityLevel(): ?ComplexityLevelType {
    let { result } = this.getComplexityLevelRequest;
    if (result == null) {
      result = this.getComplexityLevelRequest.execute().result;
    }
    return result;
  }

  @computed get isComplexityLevelSelected(): boolean {
    return !!this.getComplexityLevelRequest.result;
  }

  _selectComplexityLevel: ComplexityLevelType => Promise<void> = async (
    level: ComplexityLevelType
  ): Promise<void> => {
    await this.setComplexityLevelRequest.execute(level);
    await this.getComplexityLevelRequest.execute();
  };
  _getSelectComplexityLevel: void => void = () => {
    this.getComplexityLevelRequest.execute();
  };

  // ========== Last Launch Version ========== //

  @computed get lastLaunchVersion(): string {
    let { result } = this.getLastLaunchVersionRequest;
    if (result == null) {
      result = this.getLastLaunchVersionRequest.execute().result;
    }
    return result != null ? result : '0.0.0';
  }

  setLastLaunchVersion: string => Promise<void> = async (version: string): Promise<void> => {
    await this.setLastLaunchVersionRequest.execute(version);
    await this.getLastLaunchVersionRequest.execute(); // eagerly cache
  };

  @computed get hasLoadedLastLaunchVersion(): boolean {
    return (
      this.getLastLaunchVersionRequest.wasExecuted &&
      this.getLastLaunchVersionRequest.result !== null
    );
  }

  // ========== Show/hide Balance ========== //

  @computed get shouldHideBalance(): boolean {
    let { result } = this.getHideBalanceRequest;
    if (result == null) {
      result = this.getHideBalanceRequest.execute().result;
    }
    return result === true;
  }

  _updateHideBalance: void => Promise<void> = async () => {
    const shouldHideBalance = this.shouldHideBalance;
    await this.setHideBalanceRequest.execute(shouldHideBalance);
    await this.getHideBalanceRequest.execute();
  };

  // ========== Accept nightly ========== //

  @action
  _acceptNightly: void => void = () => {
    this.acceptedNightly = true;
  };

  // ========== Coin Price Currency ========== //

  @computed.struct get unitOfAccount(): UnitOfAccountSettingType {
    let { result } = this.getUnitOfAccountRequest;
    if (result == null) {
      result = this.getUnitOfAccountRequest.execute().result;
    }
    return result || unitOfAccountDisabledValue;
  }

  getUnitOfAccountBlock: () => Promise<UnitOfAccountSettingType> = async () => {
    const { result } = this.getUnitOfAccountRequest;
    if (result == null) {
      await this.getUnitOfAccountRequest.execute();
    }
    if (this.getUnitOfAccountRequest.result == null) {
      throw new Error('failed to load unit of account setting');
    }
    return this.getUnitOfAccountRequest.result;
  }

  _updateUnitOfAccount: UnitOfAccountSettingType => Promise<void> = async currency => {
    await this.setUnitOfAccountRequest.execute(currency);
    await this.getUnitOfAccountRequest.execute(); // eagerly cache

    await this.stores.coinPriceStore.refreshCurrentUnit.execute().promise;
  };

  @computed get hasLoadedUnitOfAccount(): boolean {
    return this.getUnitOfAccountRequest.wasExecuted && this.getUnitOfAccountRequest.result !== null;
  }
}

export function getTermsOfUse(api: 'ada', currentLocale: string): string {
  return require(`../../i18n/locales/terms-of-use/${api}/${currentLocale}.md`).default;
}
