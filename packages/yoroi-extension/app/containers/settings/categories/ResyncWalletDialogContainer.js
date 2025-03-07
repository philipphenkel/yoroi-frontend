// @flow
import type { Node } from 'react';
import { Component } from 'react';
import { computed, action, observable } from 'mobx';
import { observer } from 'mobx-react';
import { defineMessages, intlShape } from 'react-intl';
import globalMessages from '../../../i18n/global-messages';
import { messages } from '../../../components/wallet/settings/ResyncBlock';
import { PublicDeriver } from '../../../api/ada/lib/storage/models/PublicDeriver/index';
import type { $npm$ReactIntl$IntlFormat } from 'react-intl';

import type { InjectedOrGenerated } from '../../../types/injectedPropsType';

import DangerousActionDialog from '../../../components/widgets/DangerousActionDialog';
import LocalizableError from '../../../i18n/LocalizableError';
import { trackResyncWallet } from '../../../api/analytics';

export type GeneratedData = typeof ResyncWalletDialogContainer.prototype.generated;

type Props = {|
  ...InjectedOrGenerated<GeneratedData>,
  publicDeriver: PublicDeriver<>,
|};

const dialogMessages = defineMessages({
  warning: {
    id: 'wallet.settings.resync.warning',
    defaultMessage: '!!!This will also cause failed transactions to disappear as they are not stored on the blockchain.',
  },
});

@observer
export default class ResyncWalletDialogContainer extends Component<Props> {
  static contextTypes: {|intl: $npm$ReactIntl$IntlFormat|} = {
    intl: intlShape.isRequired,
  };

  componentWillUnmount() {
    this.generated.stores.walletSettings.clearHistory.reset();
  }

  @observable isChecked: boolean = false;

  @action
  toggleCheck: void => void = () => {
    if (this.generated.stores.walletSettings.clearHistory.isExecuting) return;
    this.isChecked = !this.isChecked;
  }

  render(): Node {
    const { intl } = this.context;
    const settingsStore = this.generated.stores.walletSettings;

    return (
      <DangerousActionDialog
        title={intl.formatMessage(messages.titleLabel)}
        checkboxAcknowledge={intl.formatMessage(globalMessages.uriLandingDialogConfirmLabel)}
        isChecked={this.isChecked}
        toggleCheck={this.toggleCheck}
        isSubmitting={settingsStore.clearHistory.isExecuting}
        error={settingsStore.clearHistory.error}
        primaryButton={{
          label: intl.formatMessage(globalMessages.resyncButtonLabel),
          onClick: async () => {
            await this.generated.actions.walletSettings.resyncHistory.trigger({
              publicDeriver: this.props.publicDeriver,
            });
            this.generated.actions.dialogs.closeActiveDialog.trigger();
            trackResyncWallet();
          }
        }}
        onCancel={this.generated.actions.dialogs.closeActiveDialog.trigger}
        secondaryButton={{
          onClick: this.generated.actions.dialogs.closeActiveDialog.trigger
        }}
      >
        <p>{intl.formatMessage(messages.resyncExplanation)}</p>
        <p>{intl.formatMessage(dialogMessages.warning)}</p>
      </DangerousActionDialog>
    );
  }

  @computed get generated(): {|
    actions: {|
      dialogs: {|
        closeActiveDialog: {|
          trigger: (params: void) => void
        |}
      |},
      walletSettings: {|
        resyncHistory: {|
          trigger: (params: {|
            publicDeriver: PublicDeriver<>
          |}) => Promise<void>
        |}
      |}
    |},
    stores: {|
      walletSettings: {|
        clearHistory: {|
          error: ?LocalizableError,
          isExecuting: boolean,
          reset: () => void
        |}
      |}
    |}
    |} {
    if (this.props.generated !== undefined) {
      return this.props.generated;
    }
    if (this.props.stores == null || this.props.actions == null) {
      throw new Error(`${nameof(ResyncWalletDialogContainer)} no way to generated props`);
    }
    const { actions, stores } = this.props;
    const settingActions = actions.walletSettings;
    const settingStore = stores.walletSettings;
    return Object.freeze({
      stores: {
        walletSettings: {
          clearHistory: {
            reset: settingStore.clearHistory.reset,
            isExecuting: settingStore.clearHistory.isExecuting,
            error: settingStore.clearHistory.error,
          },
        },
      },
      actions: {
        walletSettings: {
          resyncHistory: { trigger: settingActions.resyncHistory.trigger },
        },
        dialogs: {
          closeActiveDialog: { trigger: actions.dialogs.closeActiveDialog.trigger },
        },
      },
    });
  }
}
