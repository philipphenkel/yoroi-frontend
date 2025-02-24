// @flow
import type { ComponentType, Node } from 'react';
import type { $npm$ReactIntl$IntlFormat } from 'react-intl';
import type { GeneratedData as BannerContainerData } from '../../banners/BannerContainer';
import type { InjectedOrGenerated } from '../../../types/injectedPropsType';
import type { GeneratedData as SidebarContainerData } from '../../SidebarContainer';
import type { GeneratedData as NavBarContainerRevampData } from '../../NavBarContainerRevamp';
import type { LayoutComponentMap } from '../../../styles/context/layout';
import type { ConfigType } from '../../../../config/config-types';
import type { TxRequests } from '../../../stores/toplevel/TransactionsStore';
import type { DelegationRequests, PoolMeta } from '../../../stores/toplevel/DelegationStore';
import type { GeneratedData as UnmangleTxDialogContainerData } from '../../transfer/UnmangleTxDialogContainer';
import type { GeneratedData as DeregisterDialogContainerData } from '../../transfer/DeregisterDialogContainer';
import type { TokenInfoMap } from '../../../stores/toplevel/TokenInfoStore';
import type { NetworkRow } from '../../../api/ada/lib/storage/database/primitives/tables';
import type { UnitOfAccountSettingType } from '../../../types/unitOfAccountType';
import type { AdaDelegationRequests } from '../../../stores/ada/AdaDelegationStore';
import type { GeneratedData as WithdrawalTxDialogContainerData } from '../../transfer/WithdrawalTxDialogContainer';
import type { PoolRequest } from '../../../api/jormungandr/lib/storage/bridge/delegationUtils';
import type { TokenEntry } from '../../../api/common/lib/MultiToken';
import type {
  CurrentTimeRequests,
  TimeCalcRequests,
} from '../../../stores/base/BaseCardanoTimeStore';

import { Component } from 'react';
import { computed } from 'mobx';
import { observer } from 'mobx-react';
import { intlShape } from 'react-intl';
import moment from 'moment';

import globalMessages from '../../../i18n/global-messages';
import BannerContainer from '../../banners/BannerContainer';
import SidebarContainer from '../../SidebarContainer';
import NavBarContainerRevamp from '../../NavBarContainerRevamp';
import TopBarLayout from '../../../components/layout/TopBarLayout';
import NavBarTitle from '../../../components/topbar/NavBarTitle';
import { PublicDeriver } from '../../../api/ada/lib/storage/models/PublicDeriver/index';
import { withLayout } from '../../../styles/context/layout';
import WalletEmptyBanner from '../WalletEmptyBanner';
import BuySellDialog from '../../../components/buySell/BuySellDialog';
import CardanoStakingPage from './CardanoStakingPage';
import { Box, styled } from '@mui/system';
import SummaryCard from '../../../components/wallet/staking/dashboard-revamp/SummaryCard';
import EpochProgressWrapper from '../../../components/wallet/staking/dashboard-revamp/EpochProgressWrapper';
import OverviewModal from '../../../components/wallet/staking/dashboard-revamp/OverviewDialog';
import LocalizableError from '../../../i18n/LocalizableError';
import { MultiToken } from '../../../api/common/lib/MultiToken';
import { genLookupOrFail } from '../../../stores/stateless/tokenHelpers';
import UnmangleTxDialogContainer from '../../transfer/UnmangleTxDialogContainer';
import DeregisterDialogContainer from '../../transfer/DeregisterDialogContainer';
import { calculateAndFormatValue } from '../../../utils/unit-of-account';
import {
  isCardanoHaskell,
  isJormungandr,
} from '../../../api/ada/lib/storage/database/prepackaged/networks';
import EpochProgressContainer from './EpochProgressContainer';
import WithdrawalTxDialogContainer from '../../transfer/WithdrawalTxDialogContainer';
import UndelegateDialog from '../../../components/wallet/staking/dashboard/UndelegateDialog';
import { generateGraphData } from '../../../utils/graph';
import { ApiOptions, getApiForNetwork } from '../../../api/common/utils';
import RewardHistoryDialog from '../../../components/wallet/staking/dashboard-revamp/RewardHistoryDialog';
import DelegatedStakePoolCard from '../../../components/wallet/staking/dashboard-revamp/DelegatedStakePoolCard';

export type GeneratedData = typeof StakingPage.prototype.generated;
// populated by ConfigWebpackPlugin
declare var CONFIG: ConfigType;
type Props = {|
  ...InjectedOrGenerated<GeneratedData>,
  actions: any,
  stores: any,
|};
type InjectedProps = {|
  +renderLayoutComponent: LayoutComponentMap => Node,
|};

type AllProps = {| ...Props, ...InjectedProps |};
@observer
class StakingPage extends Component<AllProps> {
  static contextTypes: {| intl: $npm$ReactIntl$IntlFormat |} = {
    intl: intlShape.isRequired,
  };

  onClose: void => void = () => {
    this.generated.actions.dialogs.closeActiveDialog.trigger();
  };

  _isRegistered: (PublicDeriver<>) => ?boolean = publicDeriver => {
    if (!isCardanoHaskell(publicDeriver.getParent().getNetworkInfo())) {
      return undefined;
    }
    const adaDelegationRequests = this.generated.stores.substores.ada.delegation.getDelegationRequests(
      publicDeriver
    );
    if (adaDelegationRequests == null) return undefined;
    return adaDelegationRequests.getRegistrationHistory.result?.current;
  };

  async componentDidMount() {
    const timeStore = this.generated.stores.time;
    const publicDeriver = this.generated.stores.wallets.selected;
    if (publicDeriver == null) {
      throw new Error(`${nameof(StakingPage)} no public deriver. Should never happen`);
    }
    const timeCalcRequests = timeStore.getTimeCalcRequests(publicDeriver);
    await timeCalcRequests.requests.toAbsoluteSlot.execute().promise;
    await timeCalcRequests.requests.toRealTime.execute().promise;
    await timeCalcRequests.requests.currentEpochLength.execute().promise;
    await timeCalcRequests.requests.currentSlotLength.execute().promise;
    await timeCalcRequests.requests.timeSinceGenesis.execute().promise;
  }

  getErrorInFetch: (PublicDeriver<>) => void | {| error: LocalizableError |} = publicDeriver => {
    const delegationStore = this.generated.stores.delegation;
    const delegationRequests = delegationStore.getDelegationRequests(publicDeriver);
    if (delegationRequests == null) {
      throw new Error(`${nameof(StakingPage)} opened for non-reward wallet`);
    }
    if (delegationRequests.error != null) {
      return { error: delegationRequests.error };
    }
    if (delegationRequests.getCurrentDelegation.result != null) {
      const currentDelegation = delegationRequests.getCurrentDelegation.result;
      const currEpochInfo = currentDelegation.currEpoch;
      if (currEpochInfo == null) {
        return undefined;
      }
    }
    return undefined;
  };

  getEpochLengthInDays: (PublicDeriver<>) => ?number = publicDeriver => {
    const timeStore = this.generated.stores.time;
    const timeCalcRequests = timeStore.getTimeCalcRequests(publicDeriver);
    const getEpochLength = timeCalcRequests.requests.currentEpochLength.result;
    if (getEpochLength == null) return null;

    const getSlotLength = timeCalcRequests.requests.currentSlotLength.result;
    if (getSlotLength == null) return null;

    const epochLengthInSeconds = getEpochLength() * getSlotLength();
    const epochLengthInDays = epochLengthInSeconds / (60 * 60 * 24);
    return epochLengthInDays;
  };

  getUserSummary: ({|
    delegationRequests: DelegationRequests,
    publicDeriver: PublicDeriver<>,
    errorIfPresent: void | {| error: LocalizableError |},
  |}) => Node = request => {
    const { actions, stores } = this.generated;

    const showRewardAmount =
      request.delegationRequests.getCurrentDelegation.wasExecuted &&
      request.delegationRequests.getDelegatedBalance.wasExecuted &&
      request.errorIfPresent == null;

    const defaultToken = request.publicDeriver.getParent().getDefaultToken();

    const currentlyDelegating =
      (request.delegationRequests.getCurrentDelegation.result?.currEpoch?.pools ?? []).length > 0;

    return (
      <SummaryCard
        onOverviewClick={() =>
          actions.dialogs.open.trigger({
            dialog: OverviewModal,
          })
        }
        unitOfAccount={this.toUnitOfAccount}
        getTokenInfo={genLookupOrFail(stores.tokenInfoStore.tokenInfo)}
        shouldHideBalance={stores.profile.shouldHideBalance}
        totalRewards={
          !showRewardAmount || request.delegationRequests.getDelegatedBalance.result == null
            ? undefined
            : request.delegationRequests.getDelegatedBalance.result.accountPart
        }
        totalDelegated={(() => {
          if (!showRewardAmount) return undefined;
          if (request.delegationRequests.getDelegatedBalance.result == null) return undefined;

          return currentlyDelegating
            ? request.delegationRequests.getDelegatedBalance.result.utxoPart.joinAddCopy(
                request.delegationRequests.getDelegatedBalance.result.accountPart
              )
            : new MultiToken([], defaultToken);
        })()}
        epochLength={this.getEpochLengthInDays(request.publicDeriver)}
        graphData={generateGraphData({
          delegationRequests: request.delegationRequests,
          publicDeriver: request.publicDeriver,
          currentEpoch: stores.time.getCurrentTimeRequests(request.publicDeriver).currentEpoch,
          shouldHideBalance: stores.profile.shouldHideBalance,
          getLocalPoolInfo: stores.delegation.getLocalPoolInfo,
          tokenInfo: stores.tokenInfoStore.tokenInfo,
        })}
        onOpenRewardList={() =>
          actions.dialogs.open.trigger({
            dialog: RewardHistoryDialog,
          })
        }
      />
    );
  };

  getStakePoolMeta: (PublicDeriver<>) => Node = publicDeriver => {
    const delegationStore = this.generated.stores.delegation;
    const delegationRequests = delegationStore.getDelegationRequests(publicDeriver);
    if (delegationRequests == null) {
      throw new Error(`${nameof(StakingPage)} opened for non-reward wallet`);
    }
    if (
      !delegationRequests.getCurrentDelegation.wasExecuted ||
      delegationRequests.getCurrentDelegation.isExecuting ||
      delegationRequests.getCurrentDelegation.result == null
    ) {
      return null;
    }
    if (delegationRequests.getCurrentDelegation.result.currEpoch == null) {
      return null;
    }
    const currentPools = delegationRequests.getCurrentDelegation.result.currEpoch.pools;
    const currentPage = this.generated.stores.delegation.selectedPage;

    const currentPool = currentPools[0][currentPage];
    const meta = this.generated.stores.delegation.getLocalPoolInfo(
      publicDeriver.getParent().getNetworkInfo(),
      String(currentPool)
    );
    if (meta == null) {
      // server hasn't returned information about the stake pool yet
      return null;
    }
    const { intl } = this.context;
    const name = meta.info?.name ?? intl.formatMessage(globalMessages.unknownPoolLabel);
    // TODO: remove placeholders
    const delegatedPool = {
      id: String(currentPool),
      name,
      roa: '5.1',
      poolSize: 2560000,
      share: '0.3',
      websiteUrl: meta.info?.homepage,
      ticker: meta.info?.ticker,
    };

    // TODO: implement this eventually
    // const stakePoolMeta = {
    // avatar: '',
    // websiteUrl: '',
    // roa: ' 5.08%',
    // socialLinks: {
    //   fb: '',
    //   tw: '',
    // },
    // };

    // don't support undelegation for ratio stake since it's a less intuitive UX
    const undelegate =
      currentPools.length === 1 && isJormungandr(publicDeriver.getParent().getNetworkInfo())
        ? async () => {
            this.generated.actions.dialogs.open.trigger({ dialog: UndelegateDialog });
            await this.generated.actions.jormungandr.delegationTransaction.createTransaction.trigger(
              {
                publicDeriver,
                poolRequest: undefined,
              }
            );
          }
        : undefined;

    return (
      <DelegatedStakePoolCard
        // alertMessage={alertMessage}
        delegatedPool={delegatedPool}
        undelegate={undelegate}
      />
    );
  };

  getEpochProgress: (PublicDeriver<>) => Node | void = publicDeriver => {
    const timeStore = this.generated.stores.time;
    const timeCalcRequests = timeStore.getTimeCalcRequests(publicDeriver);
    const currTimeRequests = timeStore.getCurrentTimeRequests(publicDeriver);
    const toAbsoluteSlot = timeCalcRequests.requests.toAbsoluteSlot.result;
    if (toAbsoluteSlot == null) return undefined;
    const toRealTime = timeCalcRequests.requests.toRealTime.result;
    if (toRealTime == null) return undefined;
    const timeSinceGenesis = timeCalcRequests.requests.timeSinceGenesis.result;
    if (timeSinceGenesis == null) return undefined;
    const getEpochLength = timeCalcRequests.requests.currentEpochLength.result;
    if (getEpochLength == null) return undefined;
    const currentEpoch = currTimeRequests.currentEpoch;
    const epochLength = getEpochLength();

    const getDateFromEpoch = epoch => {
      const epochTime = toRealTime({
        absoluteSlotNum: toAbsoluteSlot({
          epoch,
          // in Jormungandr, rewards were distributed at the start of the epoch
          // in Haskell, rewards are calculated at the start of the epoch but distributed at the end
          slot: isJormungandr(publicDeriver.getParent().getNetworkInfo()) ? 0 : getEpochLength(),
        }),
        timeSinceGenesisFunc: timeSinceGenesis,
      });
      const epochMoment = moment(epochTime).format('lll');
      return epochMoment;
    };

    const endEpochDate = getDateFromEpoch(currentEpoch);
    const previousEpochDate = getDateFromEpoch(currentEpoch - 1);

    return (
      <EpochProgressWrapper
        epochProgress={{
          startEpochDate: previousEpochDate,
          currentEpoch,
          endEpochDate,
          percentage: Math.floor((100 * currTimeRequests.currentSlot) / epochLength),
        }}
      />
    );
  };

  toUnitOfAccount: TokenEntry => void | {| currency: string, amount: string |} = entry => {
    const { stores } = this.generated;
    const tokenRow = stores.tokenInfoStore.tokenInfo
      .get(entry.networkId.toString())
      ?.get(entry.identifier);
    if (tokenRow == null) return undefined;

    if (!stores.profile.unitOfAccount.enabled) return undefined;
    const currency = stores.profile.unitOfAccount.currency;

    const shiftedAmount = entry.amount.shiftedBy(-tokenRow.Metadata.numberOfDecimals);
    const ticker = tokenRow.Metadata.ticker;
    if (ticker == null) {
      throw new Error('unexpected main token type');
    }
    const coinPrice = stores.coinPriceStore.getCurrentPrice(ticker, currency);
    if (coinPrice == null) return { currency, amount: '-' };
    return {
      currency,
      amount: calculateAndFormatValue(shiftedAmount, coinPrice),
    };
  };

  render(): Node {
    const sidebarContainer = <SidebarContainer {...this.generated.SidebarContainerProps} />;
    const publicDeriver = this.generated.stores.wallets.selected;
    if (publicDeriver == null) {
      throw new Error(`${nameof(StakingPage)} no public deriver. Should never happen`);
    }
    const { stores } = this.generated;
    const { uiDialogs, delegation: delegationStore } = stores;
    const delegationRequests = delegationStore.getDelegationRequests(publicDeriver);
    if (delegationRequests == null) {
      throw new Error(`${nameof(StakingPage)} opened for non-reward wallet`);
    }
    const txRequests = stores.transactions.getTxRequests(publicDeriver);
    const balance = txRequests.requests.getBalanceRequest.result;
    const isWalletWithNoFunds = balance != null && balance.getDefaultEntry().amount.isZero();

    const errorIfPresent = this.getErrorInFetch(publicDeriver);

    const showRewardAmount =
      delegationRequests.getCurrentDelegation.wasExecuted &&
      delegationRequests.getDelegatedBalance.wasExecuted &&
      errorIfPresent == null;

    const delegationHistory = delegationRequests.getCurrentDelegation.result?.fullHistory;
    const hasNeverDelegated = delegationHistory != null && delegationHistory.length === 0;

    return (
      <TopBarLayout
        banner={<BannerContainer {...this.generated.BannerContainerProps} />}
        sidebar={sidebarContainer}
        navbar={
          <NavBarContainerRevamp
            {...this.generated.NavBarContainerRevampProps}
            title={
              <NavBarTitle
                title={this.context.intl.formatMessage(globalMessages.stakingDashboard)}
              />
            }
          />
        }
        showInContainer
        showAsCard
      >
        <Box>
          {isWalletWithNoFunds ? (
            <WalletEmptyBanner
              isOpen={this.generated.stores.transactions.showWalletEmptyBanner}
              onClose={this.generated.actions.transactions.closeWalletEmptyBanner.trigger}
              onBuySellClick={() =>
                this.generated.actions.dialogs.open.trigger({ dialog: BuySellDialog })
              }
            />
          ) : null}
          {hasNeverDelegated ? null : (
            <WrapperCards>
              {this.getUserSummary({ delegationRequests, publicDeriver, errorIfPresent })}
              <RightCardsWrapper>
                {errorIfPresent}
                {!errorIfPresent && this.getStakePoolMeta(publicDeriver)}
                {!errorIfPresent && this.getEpochProgress(publicDeriver)}
              </RightCardsWrapper>
            </WrapperCards>
          )}
          <CardanoStakingPage
            stores={this.props.stores}
            actions={this.props.actions}
            urlTemplate={CONFIG.seiza.simpleTemplate}
          />
          {uiDialogs.isOpen(OverviewModal) ? (
            <OverviewModal
              onClose={this.onClose}
              getTokenInfo={genLookupOrFail(this.generated.stores.tokenInfoStore.tokenInfo)}
              totalRewards={
                !showRewardAmount || delegationRequests.getDelegatedBalance.result == null
                  ? undefined
                  : delegationRequests.getDelegatedBalance.result.accountPart
              }
              shouldHideBalance={this.generated.stores.profile.shouldHideBalance}
              unitOfAccount={this.toUnitOfAccount}
              withdrawRewards={
                this._isRegistered(delegationRequests.publicDeriver) === true
                  ? () => {
                      this.generated.actions.dialogs.open.trigger({
                        dialog: DeregisterDialogContainer,
                      });
                    }
                  : undefined
              }
            />
          ) : null}
          {uiDialogs.isOpen(DeregisterDialogContainer) ? (
            <DeregisterDialogContainer
              {...this.generated.DeregisterDialogContainerProps}
              alwaysShowDeregister
              onNext={() => {
                // note: purposely don't await
                // since the next dialog will properly render the spinner
                this.generated.actions.ada.delegationTransaction.createWithdrawalTxForWallet.trigger(
                  { publicDeriver }
                );
                this.generated.actions.dialogs.open.trigger({
                  dialog: WithdrawalTxDialogContainer,
                });
              }}
            />
          ) : null}
          {uiDialogs.isOpen(UnmangleTxDialogContainer) ? (
            <UnmangleTxDialogContainer
              {...this.generated.UnmangleTxDialogContainerProps}
              onClose={this.onClose}
            />
          ) : null}
          {uiDialogs.isOpen(WithdrawalTxDialogContainer) ? (
            <WithdrawalTxDialogContainer
              {...this.generated.WithdrawalTxDialogContainerProps}
              onClose={() => {
                this.generated.actions.ada.delegationTransaction.reset.trigger({
                  justTransaction: false,
                });
                this.generated.actions.dialogs.closeActiveDialog.trigger();
              }}
            />
          ) : null}
          {uiDialogs.isOpen(RewardHistoryDialog) ? (
            <RewardHistoryDialog
              onClose={this.onClose}
              graphData={generateGraphData({
                delegationRequests,
                publicDeriver,
                currentEpoch: stores.time.getCurrentTimeRequests(publicDeriver).currentEpoch,
                shouldHideBalance: stores.profile.shouldHideBalance,
                getLocalPoolInfo: stores.delegation.getLocalPoolInfo,
                tokenInfo: stores.tokenInfoStore.tokenInfo,
              })}
            />
          ) : null}
        </Box>
      </TopBarLayout>
    );
  }

  @computed get generated(): {|
    BannerContainerProps: InjectedOrGenerated<BannerContainerData>,
    NavBarContainerRevampProps: InjectedOrGenerated<NavBarContainerRevampData>,
    SidebarContainerProps: InjectedOrGenerated<SidebarContainerData>,
    DeregisterDialogContainerProps: InjectedOrGenerated<DeregisterDialogContainerData>,
    UnmangleTxDialogContainerProps: InjectedOrGenerated<UnmangleTxDialogContainerData>,
    WithdrawalTxDialogContainerProps: InjectedOrGenerated<WithdrawalTxDialogContainerData>,
    actions: {|
      ada: {|
        delegationTransaction: {|
          reset: {| trigger: (params: {| justTransaction: boolean |}) => void |},
          createWithdrawalTxForWallet: {|
            trigger: (params: {| publicDeriver: PublicDeriver<> |}) => Promise<void>,
          |},
        |},
      |},
      jormungandr: {|
        delegationTransaction: {|
          createTransaction: {|
            trigger: (params: {|
              poolRequest: PoolRequest,
              publicDeriver: PublicDeriver<>,
            |}) => Promise<void>,
          |},
        |},
      |},
      dialogs: {|
        open: {|
          trigger: (params: {|
            dialog: any,
            params?: any,
          |}) => void,
        |},
        closeActiveDialog: {|
          trigger: (params: void) => void,
        |},
      |},
      transactions: {|
        closeWalletEmptyBanner: {|
          trigger: (params: void) => void,
        |},
        closeDelegationBanner: {|
          trigger: (params: void) => void,
        |},
      |},
    |},
    stores: {|
      uiDialogs: {|
        getParam: <T>(number | string) => T,
        isOpen: any => boolean,
      |},
      coinPriceStore: {|
        getCurrentPrice: (from: string, to: string) => ?string,
      |},
      substores: {|
        ada: {|
          delegation: {|
            getDelegationRequests: (PublicDeriver<>) => void | AdaDelegationRequests,
          |},
        |},
      |},
      delegation: {|
        selectedPage: number,
        getLocalPoolInfo: ($ReadOnly<NetworkRow>, string) => void | PoolMeta,
        getDelegationRequests: (PublicDeriver<>) => void | DelegationRequests,
      |},
      profile: {|
        shouldHideBalance: boolean,
        unitOfAccount: UnitOfAccountSettingType,
      |},
      tokenInfoStore: {|
        tokenInfo: TokenInfoMap,
      |},
      wallets: {| selected: null | PublicDeriver<> |},
      transactions: {|
        showWalletEmptyBanner: boolean,
        showDelegationBanner: boolean,
        getTxRequests: (PublicDeriver<>) => TxRequests,
      |},
      time: {|
        getCurrentTimeRequests: (PublicDeriver<>) => CurrentTimeRequests,
        getTimeCalcRequests: (PublicDeriver<>) => TimeCalcRequests,
      |},
    |},
  |} {
    if (this.props.generated !== undefined) {
      return this.props.generated;
    }
    if (this.props.stores == null || this.props.actions == null) {
      throw new Error(`${nameof(StakingPage)} no way to generated props`);
    }
    const { stores, actions } = this.props;

    const selected = stores.wallets.selected;
    if (selected == null) {
      throw new Error(`${nameof(EpochProgressContainer)} no wallet selected`);
    }
    const api = getApiForNetwork(selected.getParent().getNetworkInfo());
    const time = (() => {
      if (api === ApiOptions.ada) {
        return {
          getTimeCalcRequests: stores.substores.ada.time.getTimeCalcRequests,
          getCurrentTimeRequests: stores.substores.ada.time.getCurrentTimeRequests,
        };
      }
      if (api === ApiOptions.jormungandr) {
        return {
          getTimeCalcRequests: stores.substores.jormungandr.time.getTimeCalcRequests,
          getCurrentTimeRequests: stores.substores.jormungandr.time.getCurrentTimeRequests,
        };
      }
      return {
        getTimeCalcRequests: (undefined: any),
        getCurrentTimeRequests: () => {
          throw new Error(`${nameof(StakingPage)} api not supported`);
        },
      };
    })();
    return Object.freeze({
      stores: {
        wallets: {
          selected: stores.wallets.selected,
        },
        profile: {
          shouldHideBalance: stores.profile.shouldHideBalance,
          unitOfAccount: stores.profile.unitOfAccount,
        },
        delegation: {
          selectedPage: stores.delegation.selectedPage,
          getLocalPoolInfo: stores.delegation.getLocalPoolInfo,
          getDelegationRequests: stores.delegation.getDelegationRequests,
        },
        uiDialogs: {
          isOpen: stores.uiDialogs.isOpen,
          getParam: stores.uiDialogs.getParam,
        },
        transactions: {
          showWalletEmptyBanner: stores.transactions.showWalletEmptyBanner,
          showDelegationBanner: stores.transactions.showDelegationBanner,
          getTxRequests: stores.transactions.getTxRequests,
        },
        tokenInfoStore: {
          tokenInfo: stores.tokenInfoStore.tokenInfo,
        },
        coinPriceStore: {
          getCurrentPrice: stores.coinPriceStore.getCurrentPrice,
        },
        substores: {
          ada: {
            delegation: {
              getDelegationRequests: stores.substores.ada.delegation.getDelegationRequests,
            },
          },
        },
        time,
      },
      actions: {
        ada: {
          delegationTransaction: {
            reset: {
              trigger: actions.ada.delegationTransaction.reset.trigger,
            },
            createWithdrawalTxForWallet: {
              trigger: actions.ada.delegationTransaction.createWithdrawalTxForWallet.trigger,
            },
          },
        },
        jormungandr: {
          delegationTransaction: {
            createTransaction: {
              trigger: actions.jormungandr.delegationTransaction.createTransaction.trigger,
            },
          },
        },
        transactions: {
          closeWalletEmptyBanner: {
            trigger: actions.transactions.closeWalletEmptyBanner.trigger,
          },
          closeDelegationBanner: {
            trigger: actions.transactions.closeDelegationBanner.trigger,
          },
        },
        dialogs: {
          open: {
            trigger: actions.dialogs.open.trigger,
          },
          closeActiveDialog: { trigger: actions.dialogs.closeActiveDialog.trigger },
        },
      },
      SidebarContainerProps: ({ actions, stores }: InjectedOrGenerated<SidebarContainerData>),
      NavBarContainerRevampProps: ({
        actions,
        stores,
      }: InjectedOrGenerated<NavBarContainerRevampData>),
      BannerContainerProps: ({ actions, stores }: InjectedOrGenerated<BannerContainerData>),
      UnmangleTxDialogContainerProps: ({
        stores,
        actions,
      }: InjectedOrGenerated<UnmangleTxDialogContainerData>),
      WithdrawalTxDialogContainerProps: ({
        stores,
        actions,
      }: InjectedOrGenerated<WithdrawalTxDialogContainerData>),
      DeregisterDialogContainerProps: ({
        stores,
        actions,
      }: InjectedOrGenerated<DeregisterDialogContainerData>),
    });
  }
}
export default (withLayout(StakingPage): ComponentType<Props>);

const WrapperCards = styled(Box)({
  display: 'flex',
  gap: '40px',
  justifyContent: 'space-between',
  marginBottom: '40px',
  height: '556px',
});

const RightCardsWrapper = styled(Box)({
  display: 'flex',
  flex: '1 1 48.5%',
  maxWidth: '48.5%',
  flexDirection: 'column',
  gap: '40px',
});
