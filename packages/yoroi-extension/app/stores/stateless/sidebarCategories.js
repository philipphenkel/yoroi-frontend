// @flow
import { ROUTES } from '../../routes-config';
import type { MessageDescriptor } from 'react-intl';
import globalMessages, { connectorMessages } from '../../i18n/global-messages';
import { ReactComponent as walletsIcon }  from '../../assets/images/sidebar/my_wallets.inline.svg';
import { ReactComponent as transferIcon }  from '../../assets/images/sidebar/transfer_wallets.inline.svg';
import { ReactComponent as settingsIcon }  from '../../assets/images/sidebar/wallet-settings-2-ic.inline.svg';
import { ReactComponent as goBackIcon }  from '../../assets/images/top-bar/back-arrow-white.inline.svg';
import { ReactComponent as dappConnectorIcon }  from '../../assets/images/dapp-connector/dapp-connector.inline.svg';
import { ReactComponent as noticeBoardIcon }  from '../../assets/images/notice-board/notice-board.inline.svg';
import { matchRoute } from '../../utils/routing';
import environment from '../../environment';
import { asGetStakingKey } from '../../api/ada/lib/storage/models/PublicDeriver/traits';

import { ReactComponent as walletIcon }  from '../../assets/images/sidebar/revamp/wallet.inline.svg';
import { ReactComponent as stakingIcon }  from '../../assets/images/sidebar/revamp/staking.inline.svg';
import { ReactComponent as assetsIcon }  from '../../assets/images/sidebar/revamp/assets.inline.svg';
import { ReactComponent as nftsIcon } from '../../assets/images/sidebar/revamp/nfts.inline.svg';
import { ReactComponent as votingIcon }  from '../../assets/images/sidebar/revamp/voting.inline.svg';
// import { ReactComponent as swapIcon }  from '../../assets/images/sidebar/revamp/swap.inline.svg';
import { ReactComponent as settingIcon }  from '../../assets/images/sidebar/revamp/setting.inline.svg';
import { PublicDeriver } from '../../api/ada/lib/storage/models/PublicDeriver';
import { isCardanoHaskell } from '../../api/ada/lib/storage/database/prepackaged/networks';

export type SidebarCategory = {|
  +className: string,
  +route: string,
  +icon: string,
  +label?: MessageDescriptor,
  +isVisible: ({|
    hasAnyWallets: boolean,
    selected: null | PublicDeriver<>,
    currentRoute: string,
  |}) => boolean,
|};

export const allCategories: Array<SidebarCategory> = [];
function registerCategory(category: SidebarCategory): SidebarCategory {
  allCategories.push(category);
  return category;
}

export const MY_WALLETS: SidebarCategory = registerCategory({
  className: 'wallets',
  route: ROUTES.MY_WALLETS,
  icon: walletsIcon,
  label: globalMessages.sidebarWallets,
  isVisible: request =>
    request.hasAnyWallets &&
    request.selected == null &&
    matchRoute(ROUTES.WALLETS.ADD, request.currentRoute) === false,
});
export const WALLETS_ROOT: SidebarCategory = registerCategory({
  className: 'wallets',
  route: ROUTES.WALLETS.ROOT,
  icon: walletsIcon,
  label: globalMessages.sidebarWallets,
  isVisible: request => request.hasAnyWallets && request.selected != null,
});

export const BACK_TO_ADD: SidebarCategory = registerCategory({
  className: 'go-back',
  route: ROUTES.WALLETS.ADD,
  icon: goBackIcon,
  label: globalMessages.goBack,
  isVisible: request => !request.hasAnyWallets,
});

export const BACK_TO_MY_WALLETS: SidebarCategory = registerCategory({
  className: 'go-back',
  route: ROUTES.MY_WALLETS,
  icon: goBackIcon,
  label: globalMessages.goBack,
  isVisible: request =>
    request.hasAnyWallets &&
    request.selected == null &&
    matchRoute(ROUTES.WALLETS.ADD, request.currentRoute) !== false,
});

export const SETTINGS: SidebarCategory = registerCategory({
  className: 'settings',
  route: ROUTES.SETTINGS.ROOT,
  icon: settingsIcon,
  label: globalMessages.sidebarSettings,
  isVisible: _request => true,
});

export const TRANSFER_PAGE: SidebarCategory = registerCategory({
  className: 'wallet-transfer',
  route: ROUTES.TRANSFER.ROOT,
  icon: transferIcon,
  label: globalMessages.sidebarTransfer,
  isVisible: _request => true,
});


export const DAPP_CONNECTOR: SidebarCategory = registerCategory({
  className: 'dapp-connector',
  route: ROUTES.DAPP_CONNECTOR.CONNECTED_WEBSITES,
  icon: dappConnectorIcon,
  label: connectorMessages.dappConnector,
  isVisible: _request => !environment.isLight,
});

export const NOTICE_BOARD: SidebarCategory = registerCategory({
  className: 'notice-board',
  route: ROUTES.NOTICE_BOARD.ROOT,
  icon: noticeBoardIcon,
  isVisible: _request => !environment.isProduction(),
});
export type SidebarCategoryRevamp = {|
  +className: string,
  +route: string,
  +icon: string,
  +label?: MessageDescriptor,
  +isVisible: ({|
    hasAnyWallets: boolean,
    selected: null | PublicDeriver<>,
    currentRoute: string,
  |}) => boolean,
|};
// TODO: Fix routes and isVisible prop
export const allCategoriesRevamp: Array<SidebarCategoryRevamp> = [
  {
    className: 'wallets',
    route: ROUTES.MY_WALLETS,
    icon: walletIcon,
    label: globalMessages.walletLabel,
    isVisible: _request => true,
  },
  {
    className: 'staking',
    route: ROUTES.STAKING,
    icon: stakingIcon,
    label: globalMessages.sidebarStaking,
    isVisible: ({ selected }) => (
      !!selected && isCardanoHaskell(selected.getParent().getNetworkInfo())
    ),
  },
  {
    className: 'assets',
    route: ROUTES.ASSETS.ROOT,
    icon: assetsIcon,
    label: globalMessages.sidebarAssets,
    isVisible: _request => _request.selected !== null,
  },
  {
    className: 'nfts',
    route: ROUTES.NFTS.ROOT,
    icon: nftsIcon,
    label: globalMessages.sidebarNfts,
    isVisible: _request => _request.selected !== null,
  },
  {
    className: 'voting',
    route: ROUTES.WALLETS.CATALYST_VOTING,
    icon: votingIcon,
    label: globalMessages.sidebarVoting,
    // $FlowFixMe[prop-missing]
    isVisible: request => asGetStakingKey(request.selected) != null,
  },
  // {
  //   className: 'swap',
  //   route: '/swap',
  //   icon: swapIcon,
  //   label: globalMessages.sidebarSwap,
  //   isVisible: _request => true,
  // },
  {
    className: 'settings',
    route: '/settings',
    icon: settingIcon,
    label: globalMessages.sidebarSettings,
    isVisible: _request => true,
  },
  // {
  //   className: 'new-updates',
  //   route: '/new-updates',
  //   icon: newUpdatesIcon,
  //   label: globalMessages.sidebarNewUpdates,
  //   isVisible: _request => true,
  // },
  // {
  //   className: 'feedback',
  //   route: '/feedback',
  //   icon: feedbackIcon,
  //   label: globalMessages.sidebarFeedback,
  //   isVisible: _request => true,
  // },
];
