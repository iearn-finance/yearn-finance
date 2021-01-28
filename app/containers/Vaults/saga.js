import BigNumber from 'bignumber.js';
import { selectAccount } from 'containers/ConnectionProvider/selectors';
import { approveTxSpend } from 'utils/contracts';
import request from 'utils/request';
import { APP_INITIALIZED } from 'containers/App/constants';
import { ACCOUNT_UPDATED } from 'containers/ConnectionProvider/constants';
import { call, put, takeLatest, select, all, take } from 'redux-saga/effects';
import {
  selectSelectedAccount,
  selectVaults,
  selectTokenAllowance,
  selectContractData,
} from 'containers/App/selectors';
import { vaultsLoaded, userVaultStatisticsLoaded } from './actions';
import {
  VAULTS_LOADED,
  WITHDRAW_FROM_VAULT,
  DEPOSIT_TO_VAULT,
} from './constants';

// TODO: Do better... never hard-code vault addresses
const v1WethVaultAddress = '0xe1237aA7f535b0CC33Fd973D66cBf830354D16c7';
const ethAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const injectEthVault = (vaults) => {
  const ethereumString = 'Ethereum';
  const wethVault = _.find(vaults, { address: v1WethVaultAddress });
  const ethVault = _.clone(wethVault);
  ethVault.displayName = ethereumString;
  ethVault.pureEthereum = true;
  ethVault.tokenAddress = ethAddress;
  ethVault.tokenMetadata.address = ethAddress;
  ethVault.tokenMetadata.symbol = 'ETH';
  vaults.push(ethVault);
  return vaults;
};

function* fetchVaults() {
  try {
    const url = `https://api.yearn.tools/vaults/all`;
    const vaults = yield call(request, url);
    const vaultsWithEth = injectEthVault(vaults);
    yield put(vaultsLoaded(vaultsWithEth));
  } catch (err) {
    console.log('Error reading vaults', err);
  }
}

function* fetchUserVaultStatistics() {
  try {
    const selectedAccount = yield select(selectSelectedAccount());
    const vaults = yield select(selectVaults());

    const userVaultStatisticsUrl = `https://api.yearn.tools/user/${selectedAccount}/vaults?statistics=true&apy=true`;
    const userVaultStatistics = yield call(request, userVaultStatisticsUrl);
    const vaultsWithUserStatistics = vaults.reduce((current, next) => {
      const userDepositedInNextVault = userVaultStatistics.find(
        (userVaultStatistic) =>
          next.vaultAlias === userVaultStatistic.vaultAlias,
      );
      if (userDepositedInNextVault) {
        return current.concat({ ...next, ...userDepositedInNextVault });
      }
      return current.concat(next);
    }, []);
    // console.log(vaultsWithUserStatistics);
    yield put(userVaultStatisticsLoaded(vaultsWithUserStatistics));
  } catch (err) {
    console.log('Error reading vaults', err);
  }
}

function* withdrawFromVault(action) {
  const {
    vaultContract,
    withdrawalAmount,
    decimals,
    pureEthereum,
  } = action.payload;

  const account = yield select(selectAccount());

  const vaultContractData = yield select(
    selectContractData(vaultContract.address),
  );

  const v2Vault = _.get(vaultContractData, 'pricePerShare');

  let sharesForWithdrawal;
  if (v2Vault) {
    const sharePrice = _.get(vaultContractData, 'pricePerShare');
    sharesForWithdrawal = new BigNumber(withdrawalAmount)
      .dividedBy(sharePrice / 10 ** decimals)
      .decimalPlaces(0)
      .toFixed(0);
  } else {
    const sharePrice = _.get(vaultContractData, 'getPricePerFullShare');
    sharesForWithdrawal = new BigNumber(withdrawalAmount)
      .dividedBy(sharePrice / 10 ** 18)
      .decimalPlaces(0)
      .toFixed(0);
  }

  try {
    if (!pureEthereum) {
      yield call(
        vaultContract.methods.withdraw.cacheSend,
        sharesForWithdrawal,
        {
          from: account,
        },
      );
    } else {
      yield call(
        vaultContract.methods.withdrawETH.cacheSend,
        sharesForWithdrawal,
        {
          from: account,
        },
      );
    }
  } catch (error) {
    console.error(error);
  }
}

function* depositToVault(action) {
  const {
    vaultContract,
    tokenContract,
    depositAmount,
    pureEthereum,
  } = action.payload;

  const account = yield select(selectAccount());
  const tokenAllowance = yield select(
    selectTokenAllowance(tokenContract.address, vaultContract.address),
  );

  const vaultAllowedToSpendToken = tokenAllowance > 0;

  try {
    if (!pureEthereum) {
      if (!vaultAllowedToSpendToken) {
        yield call(
          approveTxSpend,
          tokenContract,
          account,
          vaultContract.address,
        );
      }
      yield call(vaultContract.methods.deposit.cacheSend, depositAmount, {
        from: account,
      });
    } else {
      yield call(vaultContract.methods.depositETH.cacheSend, {
        from: account,
        value: depositAmount,
      });
    }
  } catch (error) {
    console.error(error);
  }
}

export default function* initialize() {
  yield takeLatest([APP_INITIALIZED], fetchVaults);
  // Wait for these two to have already executed
  yield all([take(ACCOUNT_UPDATED), take(VAULTS_LOADED)]);
  yield fetchUserVaultStatistics();
  yield takeLatest(WITHDRAW_FROM_VAULT, withdrawFromVault);
  yield takeLatest(DEPOSIT_TO_VAULT, depositToVault);
}
