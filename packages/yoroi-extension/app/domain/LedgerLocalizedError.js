// @flow

import LocalizableError, { UnexpectedError } from '../i18n/LocalizableError';
import { IncorrectDeviceError, IncorrectVersionError } from './ExternalDeviceCommon';
import globalMessages from '../i18n/global-messages';
import { defineMessages } from 'react-intl';

import {
  Logger,
  stringifyError
} from '../utils/logging';

export const ledgerErrors: * = defineMessages({
  cancelOnDeviceError101: {
    id: 'wallet.hw.ledger.common.error.101',
    defaultMessage: '!!!Operation cancelled on Ledger device.',
  },
  cancelOnLedgerConnectError102: {
    id: 'wallet.hw.ledger.common.error.102',
    defaultMessage: '!!!Operation cancelled by user.',
  },
  deviceLockedError103: {
    id: 'wallet.hw.ledger.common.error.103',
    defaultMessage: '!!!Ledger device is locked, please unlock it and retry.',
  },
  deviceLockedError104: {
    id: 'wallet.hw.ledger.common.error.104',
    defaultMessage: '!!!Ledger device timeout, please retry.',
  },
  networkError105: {
    id: 'wallet.hw.ledger.common.error.105',
    defaultMessage: '!!!Network error. Please check your internet connection.',
  },
  cip15NotSupportedError106: {
    id: 'wallet.hw.ledger.catalyst.unsupported.106',
    defaultMessage: '!!!Please upgrade your Ledger firmware version to at least 2.0.0 and Caradano app version to 2.3.2 or above.',
  },
});

export function convertToLocalizableError(error: Error): LocalizableError {
  Logger.error(`LedgerLocalizedError::convertToLocalizableError::error: ${stringifyError(error)}`);
  let localizableError: ?LocalizableError = null;

  if (error instanceof LocalizableError) {
    // It means some API Error has been thrown
    localizableError = error;
  } else if (error && error.message) {
    {
      const serialRegex = new RegExp('Error: Incorrect hardware wallet. This wallet was created with a device with serial ID ([0-9a-fA-F]+), but you are currently using ([0-9a-fA-F]+).');
      const serialRegexMatch = serialRegex.exec(error.message);
      if (serialRegexMatch) {
        return new IncorrectDeviceError({
          responseDeviceId: serialRegexMatch[1],
          expectedDeviceId: serialRegexMatch[2],
        });
      }
    }
    {
      // note: match all for supported version because it can be any semver expression
      const versionRegex = new RegExp('Incorrect Cardano app version. Supports version (.*) but you have version ([0-9.]\\.[0-9.]\\.[0-9.])');
      const versionRegexMatch = versionRegex.exec(error.message);
      if (versionRegexMatch) {
        return new IncorrectVersionError({
          supportedVersions: versionRegexMatch[1],
          responseVersion: versionRegexMatch[2],
        });
      }
    }
    // Ledger device related error happened, convert then to LocalizableError
    switch (error.message) {
      case 'TransportError: Failed to sign with Ledger device: U2F TIMEOUT':
        // Showing - Failed to connect. Please check your ledger device and retry.
        localizableError = new LocalizableError(globalMessages.ledgerError101);
        break;
      case 'DeviceStatusError: Action rejected by user':
        // Showing - Operation cancelled on Ledger device.
        localizableError = new LocalizableError(ledgerErrors.cancelOnDeviceError101);
        break;
      case 'NotAllowedError: The operation either timed out or was not allowed. See: https://w3c.github.io/webauthn/#sec-assertion-privacy.':
      case 'AbortError: The operation was aborted. ':
      case 'Forcefully cancelled by user':
        // Showing - Operation cancelled by user.
        localizableError = new LocalizableError(ledgerErrors.cancelOnLedgerConnectError102);
        break;
      case 'DeviceStatusError: Device is locked':
        // Showing - Ledger device is locked, please unlock it and retry.
        localizableError = new LocalizableError(ledgerErrors.deviceLockedError103);
        break;
      case 'NotAllowedError: The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.':
        // Showing - Ledger device timeout, please retry.
        localizableError = new LocalizableError(ledgerErrors.deviceLockedError104);
        break;
      case "LedgerConnect Error: Timeout happened, Couldn't connect to connect handler":
        // Showing - Network error. Please check your internet connection.
        localizableError = new LocalizableError(ledgerErrors.networkError105);
        break;
      case 'catalyst registration not supported':
        localizableError = new LocalizableError(
          ledgerErrors.cip15NotSupportedError106
        );
        break;
      default:
        /** we are not able to figure out why Error is thrown
          * make it, Something unexpected happened */
        localizableError = new UnexpectedError();
        break;
    }
  }

  if (!localizableError) {
    /** we are not able to figure out why Error is thrown
      * make it, Something unexpected happened */
    localizableError = new UnexpectedError();
  }

  return localizableError;
}
