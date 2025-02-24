// @flow
import type { Node } from 'react';
import { Component } from 'react';
import { computed } from 'mobx';
import { observer } from 'mobx-react';
import { intlShape } from 'react-intl';
import type { InjectedOrGenerated } from '../../../types/injectedPropsType';
import EpochProgress from '../../../components/wallet/staking/dashboard/EpochProgress';
import { PublicDeriver } from '../../../api/ada/lib/storage/models/PublicDeriver/index';
import type { $npm$ReactIntl$IntlFormat } from 'react-intl';
import type { CurrentTimeRequests, TimeCalcRequests } from '../../../stores/base/BaseCardanoTimeStore';
import { ApiOptions, getApiForNetwork } from '../../../api/common/utils';
import { isJormungandr } from '../../../api/ada/lib/storage/database/prepackaged/networks';

export type GeneratedData = typeof EpochProgressContainer.prototype.generated;

type Props = {|
  ...InjectedOrGenerated<GeneratedData>,
  +publicDeriver: PublicDeriver<>,
  +showTooltip: boolean,
|};

@observer
export default class EpochProgressContainer extends Component<Props> {
  static contextTypes: {|intl: $npm$ReactIntl$IntlFormat|} = {
    intl: intlShape.isRequired,
  };

  async componentDidMount() {
    const timeStore = this.generated.stores.time;
    if (this.props.publicDeriver == null) {
      throw new Error(`${nameof(EpochProgressContainer)} no public deriver. Should never happen`);
    }
    const timeCalcRequests = timeStore.getTimeCalcRequests(this.props.publicDeriver);
    // calculate these so the cached result is available in the render function
    await timeCalcRequests.requests.currentEpochLength.execute().promise;
    await timeCalcRequests.requests.currentSlotLength.execute().promise;
  }

  _leftPadDate: number => string = (num) => {
    if (num < 10) return '0' + num;
    return num.toString();
  };

  render(): Node {
    const timeStore = this.generated.stores.time;
    const timeCalcRequests = timeStore.getTimeCalcRequests(this.props.publicDeriver);
    const currTimeRequests = timeStore.getCurrentTimeRequests(this.props.publicDeriver);

    const getEpochLength = timeCalcRequests.requests.currentEpochLength.result;
    if (getEpochLength == null) return (<EpochProgress loading />);

    const getSlotLength = timeCalcRequests.requests.currentSlotLength.result;
    if (getSlotLength == null) return (<EpochProgress loading />);

    const epochLength = getEpochLength();
    const secondsLeftInEpoch = (epochLength - currTimeRequests.currentSlot) * getSlotLength();
    const timeLeftInEpoch = new Date(
      (1000 * secondsLeftInEpoch) - currTimeRequests.msIntoSlot
    );

    // only show a days column if there can be one in the first place
    const hasDays = new Date(
      (1000 * epochLength * getSlotLength()) - currTimeRequests.msIntoSlot
    ).getUTCDate() > 1;

    return (
      <EpochProgress
        currentEpoch={currTimeRequests.currentEpoch}
        percentage={Math.floor(100 * currTimeRequests.currentSlot / epochLength)}
        endTime={{
          d: hasDays
            ? this._leftPadDate(timeLeftInEpoch.getUTCDate() - 1)
            : undefined,
          h: this._leftPadDate(timeLeftInEpoch.getUTCHours()),
          m: this._leftPadDate(timeLeftInEpoch.getUTCMinutes()),
          s: this._leftPadDate(timeLeftInEpoch.getUTCSeconds()),
        }}
        showTooltip={this.props.showTooltip}
        useEndOfEpoch={!isJormungandr(this.props.publicDeriver.getParent().getNetworkInfo())}
      />
    );
  }

  @computed get generated(): {|
    stores: {|
      time: {|
        getCurrentTimeRequests: (
          PublicDeriver<>
        ) => CurrentTimeRequests,
        getTimeCalcRequests: (
          PublicDeriver<>
        ) => TimeCalcRequests
      |}
    |}
    |} {
    if (this.props.generated !== undefined) {
      return this.props.generated;
    }
    if (this.props.stores == null || this.props.actions == null) {
      throw new Error(`${nameof(EpochProgressContainer)} no way to generated props`);
    }
    const { stores, } = this.props;

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
      throw new Error(`${nameof(EpochProgressContainer)} api not supported`);
    })();
    return Object.freeze({
      stores: {
        time,
      },
    });
  }

}
