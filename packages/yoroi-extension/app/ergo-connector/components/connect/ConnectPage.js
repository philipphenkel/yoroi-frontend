/* eslint-disable no-nested-ternary */
// @flow
import { Component } from 'react';
import type { Node } from 'react';
import { intlShape, defineMessages, FormattedHTMLMessage } from 'react-intl';
import type { $npm$ReactIntl$IntlFormat } from 'react-intl';
import classNames from 'classnames';
import styles from './ConnectPage.scss';
import { Button, Stack, styled, Typography } from '@mui/material';
import WalletCard from './WalletCard';
import globalMessages, { connectorMessages } from '../../../i18n/global-messages';
import { observer } from 'mobx-react';
import LoadingSpinner from '../../../components/widgets/LoadingSpinner';
import type {
  PublicDeriverCache,
  ConnectingMessage,
} from '../../../../chrome/extension/ergo-connector/types';
import { LoadingWalletStates } from '../../types';
import ProgressBar from '../ProgressBar';
import type { TokenLookupKey } from '../../../api/common/lib/MultiToken';
import type { TokenRow } from '../../../api/ada/lib/storage/database/primitives/tables';
import { environment } from '../../../environment';
import type { WalletChecksum } from '@emurgo/cip4-js';
import { PublicDeriver } from '../../../api/ada/lib/storage/models/PublicDeriver';
import { Box } from '@mui/system';
import NoItemsFoundImg from '../../assets/images/no-websites-connected.inline.svg';
import TextField from '../../../components/common/TextField';
import ReactToolboxMobxForm from '../../../utils/ReactToolboxMobxForm';
import config from '../../../config';
import vjf from 'mobx-react-form/lib/validators/VJF';
import { WrongPassphraseError } from '../../../api/ada/lib/cardanoCrypto/cryptoErrors'

const messages = defineMessages({
  subtitle: {
    id: 'ergo-connector.label.connect',
    defaultMessage: '!!!Connect to',
  },
  connectWallet: {
    id: 'ergo-connector.label.connectWallet',
    defaultMessage: '!!!Connect Wallet',
  },
  yourWallets: {
    id: 'ergo-connector.label.yourWallets',
    defaultMessage: '!!!Your Wallets',
  },
  selectAllWallets: {
    id: 'ergo-connector.label.selectAllWallets',
    defaultMessage: '!!!Select all wallets',
  },
  connectInfo: {
    id: 'ergo-connector.connect.info',
    defaultMessage: '!!!Your connection preferences will be saved to your Yoroi dApp list.',
  },
  noWalletsFound: {
    id: 'ergo-connector.connect.noWalletsFound',
    defaultMessage: '!!!Ooops, no {network} wallets found',
  },
  incorrectWalletPasswordError: {
    id: 'api.errors.IncorrectPasswordError',
    defaultMessage: '!!!Incorrect wallet password.',
  },
});

type Props = {|
  +publicDerivers: Array<PublicDeriverCache>,
  +loading: $Values<typeof LoadingWalletStates>,
  +error: string,
  +isAppAuth: boolean,
  +onConnect: (
    deriver: PublicDeriver<>,
    checksum: ?WalletChecksum,
    password: ?string
  ) => Promise<void>,
  +onCancel: void => void,
  +selectedWallet: {|
    index: number,
    deriver: ?PublicDeriver<>,
    checksum: ?WalletChecksum,
  |},
  +message: ?ConnectingMessage,
  +onSelectWallet: (PublicDeriver<>, ?WalletChecksum) => void,
  +getTokenInfo: ($ReadOnly<Inexact<TokenLookupKey>>) => $ReadOnly<TokenRow>,
  +network: string,
  +shouldHideBalance: boolean,
|};

@observer
class ConnectPage extends Component<Props> {
  static contextTypes: {| intl: $npm$ReactIntl$IntlFormat |} = {
    intl: intlShape.isRequired,
  };

  form: ReactToolboxMobxForm = new ReactToolboxMobxForm(
    {
      fields: {
        walletPassword: {
          type: 'password',
          label: this.context.intl.formatMessage(globalMessages.walletPasswordLabel),
          placeholder: this.context.intl.formatMessage(
            globalMessages.walletPasswordFieldPlaceholder
          ),
          value: '',
          validators: [
            ({ field }) => {
              if (field.value === '') {
                return [false, this.context.intl.formatMessage(globalMessages.fieldIsRequired)];
              }
              if (field.value === null) {
                return [
                  false,
                  this.context.intl.formatMessage(
                    messages.incorrectWalletPasswordError
                  )
                ];
              }
              return [true];
            },
          ],
        },
      },
    },
    {
      options: {
        validateOnChange: true,
        validationDebounceWait: config.forms.FORM_VALIDATION_DEBOUNCE_WAIT,
      },
      plugins: {
        vjf: vjf(),
      },
    }
  );

  submit: void => void = () => {
    this.form.submit({
      onSuccess: form => {
        const { walletPassword } = form.values();
        const { deriver, checksum } = this.props.selectedWallet;
        if (deriver && checksum) {
          this.props.onConnect(deriver, checksum, walletPassword).catch(error => {
            if (error instanceof WrongPassphraseError) {
              this.form.$('walletPassword').value = null;
            } else {
              throw error;
            }
          });
        }
      },
      onError: () => {},
    });
  };

  onCancel: void => void = () => {
    this.props.onCancel();
  };

  render(): Node {
    const { intl } = this.context;
    const {
      loading,
      error,
      publicDerivers,
      message,
      onSelectWallet,
      network,
      shouldHideBalance,
      isAppAuth,
    } = this.props;
    const isNightly = environment.isNightly();
    const componentClasses = classNames([styles.component, isNightly && styles.isNightly]);

    const isLoading =
      loading === LoadingWalletStates.IDLE || loading === LoadingWalletStates.PENDING;
    const isSuccess = loading === LoadingWalletStates.SUCCESS;
    const isError = loading === LoadingWalletStates.REJECTED;

    const url = message?.url ?? '';
    const faviconUrl = message?.imgBase64Url;

    const walletPasswordField = this.form.$('walletPassword');

    const hasWallets = isSuccess && Boolean(publicDerivers.length);
    const hasNoWallets = isSuccess && !publicDerivers.length;

    const passwordForm = (
      <>
        <div>
          <TextField
            type="password"
            {...walletPasswordField.bind()}
            error={walletPasswordField.error}
          />
        </div>
        <Stack direction="row" spacing={2} mt={16}>
          <Button fullWidth variant="secondary" onClick={this.onCancel} sx={{ minWidth: 'auto' }}>
            {intl.formatMessage(globalMessages.cancel)}
          </Button>
          <Button
            variant="primary"
            sx={{ minWidth: 'auto' }}
            fullWidth
            disabled={!walletPasswordField.isValid}
            onClick={this.submit}
          >
            {intl.formatMessage(globalMessages.confirm)}
          </Button>
        </Stack>
      </>
    );

    return (
      <div className={componentClasses}>
        {hasWallets ? (
          <>
            <ProgressBar step={1} />
            <Typography
              variant="h3"
              color="var(--yoroi-palette-gray-900)"
              marginTop="20px"
              paddingLeft="32px"
              fontWeight="400"
            >
              {intl.formatMessage(messages.connectWallet)}
            </Typography>
            <div className={styles.connectWrapper}>
              {faviconUrl != null && faviconUrl !== '' ? (
                <div className={styles.image}>
                  <img src={faviconUrl} alt={`${url} favicon`} />
                </div>
              ) : null}
              <Box marginTop="16px">
                <Typography variant="h5" fontWeight="300" color="var(--yoroi-palette-gray-900)">
                  {intl.formatMessage(messages.subtitle)}{' '}
                  <Typography as="span" variant="h5" fontWeight="500">
                    {url}
                  </Typography>
                </Typography>
              </Box>
            </div>
          </>
        ) : null}
        <Box flex={1} padding="0 32px 17px">
          {isAppAuth ? (
            passwordForm
          ) : (
            <Box borderBottom="1px solid #dce0e9">
              {isError ? <div className={styles.errorMessage}>{error}</div> : null}
              {isLoading ? (
                <div className={styles.loading}>
                  <LoadingSpinner />
                </div>
              ) : hasWallets ? (
                <Box>
                  <Typography
                    variant="h5"
                    fontWeight="300"
                    color="var(--yoroi-palette-gray-600)"
                    mb="14px"
                  >
                    {intl.formatMessage(messages.yourWallets)}
                  </Typography>
                  <ul className={styles.list}>
                    {publicDerivers.map(item => (
                      <li
                        key={item.publicDeriver.getPublicDeriverId()}
                        className={styles.listItem}
                      >
                        <WalletButton
                          onClick={() => onSelectWallet(item.publicDeriver, item.checksum)}
                        >
                          <WalletCard
                            shouldHideBalance={shouldHideBalance}
                            publicDeriver={item}
                            getTokenInfo={this.props.getTokenInfo}
                          />
                        </WalletButton>
                      </li>
                    ))}
                  </ul>
                </Box>
              ) : hasNoWallets ? (
                <Box display="flex" flexDirection="column" alignItems="center" pt={4}>
                  <NoItemsFoundImg style={{ width: 170 }} />
                  <Typography variant="h3" fontWeight="400" color="var(--yoroi-palette-gray-900)">
                    <FormattedHTMLMessage {...messages.noWalletsFound} values={{ network }} />
                  </Typography>
                </Box>
              ) : null}
            </Box>
          )}
        </Box>

        {hasWallets && isAppAuth ? (
          <div className={styles.bottom}>
            <div className={styles.infoText}>
              <p>{intl.formatMessage(messages.connectInfo)}</p>
              <p>{intl.formatMessage(connectorMessages.messageReadOnly)}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}

export default ConnectPage;

const WalletButton = styled('button')({
  cursor: 'pointer',
  width: '100%',
  fontSize: '1rem',
  paddingTop: 5,
  paddingBottom: 5,
});
