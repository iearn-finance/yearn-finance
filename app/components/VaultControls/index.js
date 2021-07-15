import ButtonFilled from 'components/ButtonFilled';
import RoundedInput from 'components/RoundedInput';
import RoundedSelect from 'components/RoundedSelect';
import Grid from '@material-ui/core/Grid';
import { useContract } from 'containers/DrizzleProvider/hooks';
import { useWeb3 } from 'containers/ConnectionProvider/hooks';
import OldPickleGaugeAbi from 'abi/oldPickleGauge.json';
import {
  withdrawFromVault,
  withdrawAllFromVault,
  depositToVault,
  depositPickleSLPInFarm,
  exitOldPickleGauge,
} from 'containers/Vaults/actions';
import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import BigNumber from 'bignumber.js';
import { first } from 'lodash';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { selectTokenAllowance } from 'containers/App/selectors';
import { selectMigrationData } from 'containers/Vaults/selectors';
import {
  selectZapperVaults,
  selectZapperTokens,
  selectZapperBalances,
  selectZapperError,
  selectZapperOutError,
} from 'containers/Zapper/selectors';
import { zapIn, zapOut, migratePickleGauge } from 'containers/Zapper/actions';
import { DEFAULT_SLIPPAGE, ETH_ADDRESS } from 'containers/Zapper/constants';
import BackscratcherClaim from 'components/BackscratcherClaim';
import MigrateVault from 'components/MigrateVault';
import {
  BACKSCRATCHER_ADDRESS,
  MASTER_CHEF_ADDRESS,
  V2_WETH_VAULT_ADDRESS,
  V2_WETH_VAULT_ADDRESS_042,
  YVBOOST_ADDRESS,
  YVBOOST_ETH_PJAR,
  PICKLE_GAUGE_ADDRESS,
  OLD_PICKLE_GAUGE_ADDRESS,
  ZAP_MIGRATE_PICKLE_ADDRESS,
  YALINK_VAULT_ADDRESS,
  LINK_VAULT_ADDRESS,
} from 'containers/Vaults/constants';
import Box from 'components/Box';
import Text from 'components/Text';
import Label from 'components/Label';
import PickleJarAbi2 from 'abi/pickleJar2.json';
import PickleGaugeAbi from 'abi/pickleGauge.json';
import ZapPickleMigrateAbi from 'abi/zapPickleMigrate.json';
import { Typography } from '@material-ui/core';
import SvgArrow from 'components/VaultControls/SvgArrow';
const MaxWrapper = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  color: initial;
  position: relative;
  top: -2px;
`;

const PickleControl = styled.div`
  margin-top: 1rem;
  margin-bottom: 1rem;
`;

const StyledRoundedInput = styled(RoundedInput)`
  width: 100%;
`;
const StyledRoundedSelect = styled(RoundedSelect)`
  width: 100%;
`;

const ActionGroup = styled(Box)`
  display: ${(props) => (props.hide ? 'none' : 'flex')};
  flex-direction: ${(props) => props.direction || 'column'};
`;

const ButtonGroup = styled(Box)`
  display: flex;
  justify-content: start;
  align-items: center;
`;

const Wrapper = styled.div`
  display: flex;
  width: 100%;
`;

const StyledErrorMessage = styled(Text)`
  background: #450e2b;
  padding: 20px !important;
  color: #ff0000;
  border-radius: 5px;
  margin-top: 20px;
`;

const getNormalizedAmount = (amount, decimals) =>
  new BigNumber(amount).dividedBy(10 ** decimals).toFixed(4, 1);

export default function VaultControls(props) {
  const {
    vault,
    vaultBalance,
    walletBalance,
    balanceOf,
    tokenBalance,
    pickleContractsData,
    balanceDecimalPlacesCount,
    account,
    oldPickleGaugeBalance,
    yvBOOSTBalance,
  } = props;
  const {
    address: vaultAddress,
    totalAssets,
    token,
    decimals,
    pureEthereum,
    depositLimit,
    zapAddress,
    emergencyShutdown,
  } = vault;
  const yvBoostContract = useContract(vaultAddress);

  const v2Vault = vault.type === 'v2' || vault.apiVersion;
  const vaultIsBackscratcher = vault.address === BACKSCRATCHER_ADDRESS;
  const vaultIsPickle = vault.address === MASTER_CHEF_ADDRESS;
  const vaultIsYvBoost = vault.address === YVBOOST_ADDRESS;
  const hideZapOut = [
    YALINK_VAULT_ADDRESS.toLocaleLowerCase(),
    LINK_VAULT_ADDRESS.toLocaleLowerCase(),
  ].includes(vault.address.toLowerCase());
  let vaultBalanceOf;
  if (v2Vault) {
    vaultBalanceOf = new BigNumber(balanceOf)
      .times(vault.pricePerShare / 10 ** decimals)
      .toFixed();
  } else {
    vaultBalanceOf = new BigNumber(balanceOf)
      .times(vault.getPricePerFullShare / 10 ** 18)
      .toFixed();
  }

  const isScreenMd = useMediaQuery('(min-width:960px)');
  const dispatch = useDispatch();
  let vaultContract = useContract(vaultAddress);
  const zapContract = useContract(zapAddress);
  if (zapContract) {
    vaultContract = { ...vaultContract, zapContract };
  }
  const migrationData = useSelector(selectMigrationData);
  const isMigratable = !!migrationData[vaultAddress];

  // ----- ZAPPER
  const web3 = useWeb3();
  const zapperVaults = useSelector(selectZapperVaults());
  const zapperTokens = useSelector(selectZapperTokens());
  const zapperBalances = useSelector(selectZapperBalances());
  const zapperError = useSelector(selectZapperError());
  const zapperOutError = useSelector(selectZapperOutError());
  const zapperVaultData = zapperVaults[vaultAddress.toLowerCase()];
  const isZappable = !!zapperVaultData;
  const isSupportedToken = ({ address, hide }) =>
    address !== token.address && !hide && !!zapperTokens[address];
  const isSameToken = ({ label, address }) =>
    (vaultAddress === V2_WETH_VAULT_ADDRESS && label === 'ETH') ||
    (vaultAddress === V2_WETH_VAULT_ADDRESS_042 && label === 'ETH') ||
    address === token.address.toLowerCase();
  const supportedTokenOptions = Object.values(zapperBalances)
    .filter(isSupportedToken)
    .filter((option) => !isSameToken(option))
    .map(({ address, label, img }) => ({
      value: address,
      label,
      icon: `https://zapper.fi/images/${img}`,
    }));
  supportedTokenOptions.unshift({
    value: token.address,
    label:
      // eslint-disable-next-line no-nested-ternary
      token.displayName === 'ETH'
        ? 'WETH'
        : token.displayName
        ? token.displayName
        : token.symbol.replace('yveCRV-DAO', 'yveCRV'),
    icon:
      token.displayName === 'ETH'
        ? 'https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/tokens/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo-alt-128.png'
        : token.icon,
  });
  if (token.displayName === 'ETH') {
    supportedTokenOptions.unshift({
      value: ETH_ADDRESS,
      label: 'ETH',
      icon: token.icon,
    });
  }
  const [selectedSellToken, setSelectedSellToken] = useState(
    first(supportedTokenOptions),
  );
  const sellToken = zapperBalances[selectedSellToken.value];

  const willZapIn =
    selectedSellToken && selectedSellToken.value !== token.address;

  // ------

  const tokenContract = useContract(token.address);
  const [pickleUnstakeGweiAmount, setPickleUnstakeGweiAmount] = useState(0);
  const [pickleUnstakeAmount, setPickleUnstakeAmount] = useState(0);

  const [pickleDepositGweiAmount, setPickleDepositGweiAmount] = useState(0);
  const [pickleDepositAmount, setPickleDepositAmount] = useState(0);

  const [oldPickleDepositGweiAmount, setOldPickleDepositGweiAmount] = useState(
    0,
  );
  const [oldPickleDepositAmount, setOldPickleDepositAmount] = useState(0);

  const [withdrawalAmount, setWithdrawalAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [withdrawalGweiAmount, setWithdrawalGweiAmount] = useState(0);
  const [depositGweiAmount, setDepositGweiAmount] = useState(0);
  const zapperImgUrl = 'https://zapper.fi/images/';

  const tmpWithdrawTokens = [];
  [
    {
      label: 'ETH',
      address: '0x0000000000000000000000000000000000000000',
      icon: `${zapperImgUrl}ETH-icon.png`,
      value: 'ETH',
    },
    {
      label: 'DAI',
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      icon: `${zapperImgUrl}DAI-icon.png`,
      value: 'DAI',
    },
    {
      label: 'USDC',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      icon: `${zapperImgUrl}USDC-icon.png`,
      value: 'USDC',
    },
    {
      label: 'USDT',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      icon: `${zapperImgUrl}USDT-icon.png`,
      value: 'USDT',
    },
    {
      label: 'WBTC',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      icon: `${zapperImgUrl}WBTC-icon.png`,
      value: 'WBTC',
    },
  ].map((t) => {
    if (t.label !== vault.displayName) {
      tmpWithdrawTokens.push(t);
    }
    return t;
  });
  const currentVaultToken = {
    label: token.displayName === 'ETH' ? 'WETH' : token.displayName,
    address: vault.token.address,
    isVault: true,
    icon:
      token.displayName === 'ETH'
        ? 'https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/tokens/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo-alt-128.png'
        : vault.token.icon,
    value: vault.displayName === 'ETH' ? 'WETH' : token.displayName,
  };
  if (vault.displayName === 'yvBOOST') {
    tmpWithdrawTokens.unshift({
      label: 'yveCRV',
      address: vault.token.address,
      isVault: true,
      icon:
        'https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/tokens/0xc5bDdf9843308380375a611c18B50Fb9341f502A/logo-128.png',
      value: vault.displayName,
    });
  } else {
    tmpWithdrawTokens.unshift(currentVaultToken);
    if (token.displayName === 'ETH') {
      tmpWithdrawTokens.unshift({
        label: 'ETH',
        address: ETH_ADDRESS,
        icon: vault.token.icon,
        value: 'ETH',
      });
    }
  }
  const withdrawTokens = hideZapOut ? [currentVaultToken] : tmpWithdrawTokens;

  const [selectedWithdrawToken, setSelectedWithdrawToken] = useState(
    withdrawTokens[0],
  );

  const tokenContractAddress =
    (tokenContract && tokenContract.address) || '0x0';
  const vaultContractAddress =
    (vaultContract && vaultContract.address) || '0x0';
  const tokenAllowance = useSelector(
    selectTokenAllowance(tokenContractAddress, vaultContractAddress),
  );

  const depositLimitBN = useMemo(() => new BigNumber(depositLimit), [
    depositLimit,
  ]);

  const totalAssetsBN = useMemo(() => new BigNumber(totalAssets), [
    totalAssets,
  ]);

  const approvalExplainer =
    'Before depositing for the first time, users must submit an approval transaction to allow Yearn to accept your funds. Once this approval transaction has confirmed, you can deposit any amount, forever, from this address.';

  const depositsDisabled = useMemo(() => {
    if (vault.type === 'v2') {
      if (
        !willZapIn &&
        totalAssetsBN.plus(depositGweiAmount).gte(depositLimitBN)
      ) {
        console.log('vault limit reached', vault.symbol);
        return 'Vault deposit limit reached.';
      }
      // fix: disable deposit button if value is 0
      // note: resolves issue #252 from iearn-finance repo
      // this issue only affects v2 & is mis-ticketed as v1 (iearn-finance)
      if (depositGweiAmount <= 0) {
        return 'Value must be greater than 0.';
      }
    } else if (
      vault.type === 'v1' &&
      vault.address === '0xBA2E7Fed597fd0E3e70f5130BcDbbFE06bB94fe1'
    ) {
      console.log('vault address', vault.symbol);
      return 'Inactive with YIP-56: Buyback and Build';
    }

    if (emergencyShutdown) {
      return 'Vault deposits temporarily disabled.';
    }

    return undefined;
  }, [depositAmount, totalAssets, depositLimit, emergencyShutdown]);

  const withdrawDisabled = useMemo(() => {
    if (
      vault.address === '0x03403154afc09Ce8e44C3B185C82C6aD5f86b9ab' ||
      vault.address === '0xb4D1Be44BfF40ad6e506edf43156577a3f8672eC'
    ) {
      return 'Vault withdrawals temporarily disabled.';
    }

    if (emergencyShutdown) {
      return 'Vault withdrawals temporarily disabled.';
    }

    return undefined;
  }, [vault, emergencyShutdown]);

  useEffect(() => {
    setDepositAmount(0);
    setPickleDepositAmount(0);
    setWithdrawalAmount(0);
    setDepositGweiAmount(0);
    setWithdrawalGweiAmount(0);
  }, [walletBalance, vaultBalance]);

  const [
    yvBOOSTPickleGaugeAllowance,
    setYvBOOSTPickleGaugeAllowance,
  ] = useState(0);
  const [yvBOOSTPickleJarAllowance, setYvBOOSTPickleJarAllowance] = useState(0);
  useEffect(() => {
    const getBalance = async () => {
      if (
        pickleContractsData &&
        pickleContractsData.pickleJarContract &&
        account
      ) {
        try {
          const ap = await pickleContractsData.pickleJarContract.methods
            .allowance(account, ZAP_MIGRATE_PICKLE_ADDRESS)
            .call();
          setYvBOOSTPickleJarAllowance(ap);
        } catch {
          // no worries
        }
      }
      if (vaultIsYvBoost && tokenContract && vault && vault.address) {
        try {
          const ha = await tokenContract.methods
            .allowance(account, vault.address)
            .call();

          if (ha && ha > 0) {
            vault.hasAllowance = true;
          }
        } catch {
          // no worries
        }
      }
      try {
        const yvBoostETHContract = new web3.eth.Contract(
          PickleJarAbi2,
          YVBOOST_ETH_PJAR,
        );
        const allowance = await yvBoostETHContract.methods
          .allowance(account, PICKLE_GAUGE_ADDRESS)
          .call();

        setYvBOOSTPickleGaugeAllowance(allowance);
      } catch {
        // no worries
      }
    };
    getBalance();
  });

  const migratePickleGaugeCall = async () => {
    const zapPickleMigrateContract = new web3.eth.Contract(
      ZapPickleMigrateAbi,
      ZAP_MIGRATE_PICKLE_ADDRESS,
    );
    dispatch(
      migratePickleGauge({
        pickleDepositAmount: oldPickleDepositGweiAmount,
        zapPickleMigrateContract,
        tokenContract: pickleContractsData.pickleJarContract,
        allowance: yvBOOSTPickleJarAllowance,
      }),
    );
  };

  const exitOldPickleGaugeCall = () => {
    const oldPickleGaugeContract = new web3.eth.Contract(
      OldPickleGaugeAbi,
      OLD_PICKLE_GAUGE_ADDRESS,
    );

    dispatch(exitOldPickleGauge({ oldPickleGaugeContract }));
  };
  const unstakeMasterChef = (maxAmount) => {
    const unstakeParams = {
      vaultContract: pickleContractsData.masterChefContract,
      withdrawalAmount: BigNumber(maxAmount),
      decimals: pickleContractsData.decimals,
      pureEthereum,
      unstakePickle: true,
    };
    dispatch(withdrawFromVault(unstakeParams));
  };
  const withdraw = () => {
    if (
      selectedWithdrawToken.address.toLowerCase() ===
      vault.token.address.toLowerCase()
    ) {
      plausible('withdraw', {
        props: {
          vault: vault.address,
          token: token.address,
          zap: false,
        },
      });
      dispatch(
        withdrawFromVault({
          vaultContract,
          withdrawalAmount: withdrawalGweiAmount,
          decimals,
          pureEthereum,
        }),
      );
    } else {
      plausible('withdraw', {
        props: {
          vault: vault.address,
          token: selectedWithdrawToken.address,
          zap: true,
        },
      });
      dispatch(
        zapOut({
          web3,
          slippagePercentage: DEFAULT_SLIPPAGE,
          vaultContract,
          withdrawalAmount: withdrawalGweiAmount,
          decimals,
          selectedWithdrawToken,
          pureEthereum,
        }),
      );
    }
  };

  const withdrawAll = () => {
    dispatch(
      withdrawAllFromVault({
        vaultContract,
        pureEthereum,
        balanceOf,
      }),
    );
  };

  const depositPickleFarm = () => {
    const yvBoostETHContract = new web3.eth.Contract(
      PickleJarAbi2,
      YVBOOST_ETH_PJAR,
    );
    const pickleGaugeContract = new web3.eth.Contract(
      PickleGaugeAbi,
      PICKLE_GAUGE_ADDRESS,
    );

    const payload = {
      vaultContract: pickleGaugeContract,
      tokenContract: yvBoostETHContract,
      depositAmount: pickleDepositGweiAmount,
      allowance: yvBOOSTPickleGaugeAllowance,
    };

    dispatch(depositPickleSLPInFarm(payload));
  };

  const deposit = () => {
    plausible('deposit', {
      props: {
        vault: vault.address,
        token: token.address,
        zap: false,
      },
    });
    dispatch(
      depositToVault({
        vaultContract,
        tokenContract,
        depositAmount: depositGweiAmount,
        decimals,
        pureEthereum,
        hasAllowance: vault.hasAllowance,
      }),
    );
  };

  const zapperZap = () => {
    plausible('deposit', {
      props: {
        vault: vault.address,
        token: sellToken.address,
        zap: true,
      },
    });
    dispatch(
      zapIn({
        web3,
        poolAddress: zapperVaultData.address,
        sellTokenAddress: sellToken.address,
        sellAmount: depositGweiAmount,
        slippagePercentage: DEFAULT_SLIPPAGE,
      }),
    );
  };

  const zapperZapYvBoostEthLP = () => {
    let addr = null;
    if (sellToken && sellToken.address) {
      addr = sellToken.address;
    } else if (selectedSellToken && selectedSellToken.address) {
      addr = selectedSellToken.address;
    } else if (token && token.address) {
      addr = token.address;
    }
    if (addr) {
      const payload = {
        web3,
        poolAddress: YVBOOST_ETH_PJAR.toLowerCase(),
        sellTokenAddress: addr,
        sellAmount: depositGweiAmount,
        slippagePercentage: DEFAULT_SLIPPAGE,
        protocol: 'pickle',
      };
      dispatch(zapIn(payload));
    }
  };

  let vaultControlsWrapper;

  if (vaultIsPickle && !vault.isYVBoost) {
    // let stakedMaxAmount = 0;
    // stakedMaxAmount = pickleContractsData.pickleMasterChefDepositedRaw;
    // const customWalletBalance =
    //   walletBalance > oldPickleGaugeBalance
    //     ? walletBalance
    //     : oldPickleGaugeBalance;
    const useOldPickleGauge = walletBalance < oldPickleGaugeBalance;
    let pickleMaxAmount = 0;
    let pickleBalance = 0;
    if (
      pickleContractsData &&
      pickleContractsData.pickleMasterChefDepositedRaw
    ) {
      pickleMaxAmount = pickleContractsData.pickleMasterChefDepositedRaw;
      pickleBalance = pickleContractsData.pickleMasterChefDeposited;
    }
    const pickleDescriptions = [
      {
        balance: pickleBalance,
        main: '1. You have to unstake your LP Tokens',
        sub: 'Available Pickle SLP',
        buttonLabel: 'Unstake',
        maxAmount: pickleMaxAmount,
        amount: pickleUnstakeAmount,
        amountSetter: setPickleUnstakeAmount,
        gweiAmountSetter: setPickleUnstakeGweiAmount,
        buttonFunction: useOldPickleGauge
          ? exitOldPickleGaugeCall
          : () => {
              unstakeMasterChef(pickleMaxAmount);
            },
        buttonDisable:
          pickleUnstakeGweiAmount >
            pickleContractsData.pickleMasterChefDepositedRaw ||
          pickleBalance === 0 ||
          pickleBalance === '0',
        disableAmountField: true,
        hideBalance: true,
        disabledStyle: {
          background: '#1d265f',
          color: 'white',
        },
      },
      {
        balance: walletBalance,
        main:
          '2. Then approve and migrate from yveCRV-ETH LP into yvBOOST-ETH LP to enjoy 🍣 and 🥒 rewards',
        sub: 'Available SLP: ',
        buttonLabel: yvBOOSTPickleJarAllowance > 0 ? 'Migrate' : 'Approve',
        maxAmount: new BigNumber(walletBalance).times(10 ** 18),
        amount: oldPickleDepositAmount,
        amountSetter: setOldPickleDepositAmount,
        gweiAmountSetter: setOldPickleDepositGweiAmount,
        buttonFunction: migratePickleGaugeCall,
        buttonDisable:
          oldPickleDepositGweiAmount >
          new BigNumber(walletBalance).times(10 ** 18),
      },
      {
        balance: new BigNumber(yvBOOSTBalance).dividedBy(10 ** 18).toFixed(2),
        main:
          '3. Last step! After the previous transaction completes, approve and stake your Pickle LPs using the box below',
        sub: 'Available Pickle SLP: ',
        buttonLabel: yvBOOSTPickleGaugeAllowance > 0 ? 'Stake' : 'Approve',
        maxAmount: yvBOOSTBalance,
        amount: pickleDepositAmount,
        amountSetter: setPickleDepositAmount,
        gweiAmountSetter: setPickleDepositGweiAmount,
        buttonFunction: depositPickleFarm,
        buttonDisable: pickleDepositGweiAmount > yvBOOSTBalance,
      },
    ];
    const pickleNote =
      'Note: If you want to claim PICKLE 🥒 rewards or withdraw your yvBOOST-ETH SLP, please, use UI at';
    const pickleNoteLink = 'https://app.pickle.finance/farms';
    vaultControlsWrapper = (
      <Wrapper>
        <Box display="flex" flexDirection="column" width={1}>
          {pickleDescriptions.map((description) => (
            <div key={description.main}>
              <Label fontSize={16}>{description.main}</Label>
              <PickleControl>
                <Grid item xs={12} md={6}>
                  <Balance
                    amount={description.balance}
                    prefix={description.sub}
                    hideBalance={description.hideBalance}
                  />
                  <ActionGroup
                    direction={isScreenMd ? 'row' : 'column'}
                    alignItems="center"
                  >
                    <Box width={1}>
                      <AmountField
                        disabled={description.disableAmountField}
                        amount={
                          description.disableAmountField
                            ? new BigNumber(description.maxAmount).dividedBy(
                                10 ** 18,
                              )
                            : description.amount
                        }
                        amountSetter={description.amountSetter}
                        gweiAmountSetter={description.gweiAmountSetter}
                        maxAmount={description.maxAmount}
                        decimals={decimals}
                        placeholder="Amount"
                        hideMaxButton={description.hideBalance}
                        disabledStyle={description.disabledStyle}
                      />
                    </Box>
                    <Box ml={isScreenMd ? 5 : 0} width={isScreenMd ? '30%' : 1}>
                      <ActionButton
                        disabled={description.buttonDisable}
                        handler={description.buttonFunction}
                        text={description.buttonLabel}
                        title={description.buttonLabel}
                        showTooltip
                        tooltipText={
                          depositsDisabled ||
                          'Connect your wallet to deposit into vault'
                        }
                      />
                    </Box>
                  </ActionGroup>
                </Grid>
              </PickleControl>
            </div>
          ))}
          <Label fontSize={16}> {pickleNote} </Label>
          <a href={pickleNoteLink}> {pickleNoteLink} </a>
        </Box>
      </Wrapper>
    );
  } else if (vault.isYVBoost) {
    const balance = sellToken ? sellToken.balanceRaw : tokenBalance;
    const disabled = new BigNumber(depositGweiAmount).isGreaterThan(
      new BigNumber(balance),
    );

    vaultControlsWrapper = (
      <Wrapper>
        <Box display="flex" flexDirection="column" width={1}>
          <ActionGroup direction={isScreenMd ? 'row' : 'column'}>
            <Grid container spacing={1}>
              <Grid item xs={12} md={12}>
                <Box>
                  <Balance
                    amount={sellToken ? sellToken.balance : walletBalance}
                    prefix={`Available ${
                      selectedSellToken
                        ? selectedSellToken.label
                        : sellToken.symbol
                    }: `}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <Box>
                  <SelectField
                    defaultValue={selectedSellToken}
                    onChange={(value) => {
                      setDepositAmount(0);
                      setSelectedSellToken(value);
                    }}
                    flexGrow={1}
                    options={supportedTokenOptions}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <ButtonGroup width={1} style={{ imarginTop: '' }}>
                  <Box>
                    <AmountField
                      amount={depositAmount}
                      amountSetter={setDepositAmount}
                      gweiAmountSetter={setDepositGweiAmount}
                      maxAmount={
                        sellToken ? sellToken.balanceRaw : tokenBalance
                      }
                      decimals={sellToken ? sellToken.decimals : decimals}
                    />
                  </Box>
                </ButtonGroup>
              </Grid>
              <Grid item xs={12} md={4}>
                <ButtonGroup width={1} style={{ marginTop: '-10px' }}>
                  <ActionButton
                    className="action-button dark"
                    disabled={disabled}
                    handler={() => zapperZapYvBoostEthLP()}
                    text={
                      (tokenAllowance !== undefined &&
                        tokenAllowance !== '0') ||
                      pureEthereum > 0 ||
                      'Deposit'
                    }
                    title="Deposit into vault"
                    showTooltip
                    tooltipText={
                      depositsDisabled ||
                      'Connect your wallet to deposit into vault'
                    }
                  />
                  {zapperError &&
                    zapperError.poolAddress === vaultAddress.toLowerCase() && (
                      <StyledErrorMessage>
                        {zapperError.message}
                      </StyledErrorMessage>
                    )}{' '}
                </ButtonGroup>
              </Grid>
            </Grid>
          </ActionGroup>
          <ActionGroup direction={isScreenMd ? 'row' : 'column'}>
            <Grid container spacing={1}>
              <Grid item xs={12} md={8}>
                <Box>
                  <Balance
                    amount={new BigNumber(yvBOOSTBalance)
                      .dividedBy(10 ** 18)
                      .toFixed(2)}
                    prefix="Vault balance: "
                  />
                </Box>{' '}
                <Box>
                  <AmountField
                    amount={pickleDepositAmount}
                    amountSetter={setPickleDepositAmount}
                    gweiAmountSetter={setPickleDepositGweiAmount}
                    maxAmount={yvBOOSTBalance}
                    decimals={18}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <ButtonGroup width={1} style={{ marginTop: '15px' }}>
                  <ActionButton
                    className="action-button dark"
                    disabled={yvBOOSTBalance === 0}
                    handler={() => depositPickleFarm()}
                    text={
                      !yvBOOSTPickleGaugeAllowance ||
                      yvBOOSTPickleGaugeAllowance === 0 ||
                      yvBOOSTPickleGaugeAllowance === '0'
                        ? 'Approve'
                        : 'Deposit'
                    }
                    title="Deposit into vault"
                    showTooltip
                    tooltipText={
                      depositsDisabled ||
                      'Connect your wallet to deposit into vault'
                    }
                  />
                </ButtonGroup>
              </Grid>
            </Grid>
          </ActionGroup>
        </Box>
      </Wrapper>
    );
  } else if (vaultIsBackscratcher) {
    const depositHasBeenApproved =
      (tokenAllowance !== undefined && tokenAllowance !== '0') ||
      pureEthereum > 0;
    vaultControlsWrapper = (
      <Wrapper>
        <Box display="flex" flexDirection="column" width={1}>
          <Balance amount={walletBalance} prefix="Available CRV: " />
          <ActionGroup
            direction={isScreenMd ? 'row' : 'column'}
            alignItems="center"
          >
            <Box width={1}>
              <AmountField
                amount={depositAmount}
                amountSetter={setDepositAmount}
                gweiAmountSetter={setDepositGweiAmount}
                maxAmount={tokenBalance}
                decimals={decimals}
                placeholder="Amount"
              />
            </Box>
            <Box ml={isScreenMd ? 5 : 0} width={isScreenMd ? '30%' : 1}>
              <ActionButton
                className="action-button dark"
                disabled={
                  !vaultContract || !tokenContract || !!depositsDisabled
                }
                handler={deposit}
                text={depositHasBeenApproved ? 'Deposit' : 'Approve'}
                title="Deposit into vault"
                showTooltipWhenDisabled
                disabledTooltipText={
                  depositsDisabled ||
                  'Connect your wallet to deposit into vault'
                }
                showTooltipWhenEnabled={!depositHasBeenApproved}
                enabledTooltipText={approvalExplainer}
              />
            </Box>
          </ActionGroup>
          <BackscratcherClaim
            isScreenMd={isScreenMd}
            vaultAddress={vaultAddress}
          />
        </Box>
      </Wrapper>
    );
  } else if (vaultIsYvBoost) {
    vaultControlsWrapper = (
      <Wrapper>
        <Box display="flex" flexDirection="column">
          <ActionGroup direction={isScreenMd ? 'row' : 'column'}>
            <Grid container spacing={1}>
              <Grid item xs={12} md={12}>
                <Box>
                  <Balance
                    amount={
                      isZappable && sellToken
                        ? sellToken.balance
                        : walletBalance
                    }
                    prefix={`Available ${
                      selectedSellToken
                        ? selectedSellToken.label
                        : sellToken.symbol
                    }: `}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <Box>
                  <SelectField
                    defaultValue={selectedSellToken}
                    onChange={(value) => {
                      setDepositAmount(0);
                      setSelectedSellToken(value);
                    }}
                    flexGrow={1}
                    options={supportedTokenOptions}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <ButtonGroup width={1}>
                  <Box>
                    <AmountField
                      amount={depositAmount}
                      amountSetter={setDepositAmount}
                      gweiAmountSetter={setDepositGweiAmount}
                      maxAmount={
                        isZappable && sellToken
                          ? sellToken.balanceRaw
                          : tokenBalance
                      }
                      decimals={
                        isZappable && sellToken ? sellToken.decimals : decimals
                      }
                    />
                  </Box>
                </ButtonGroup>
              </Grid>
              <Grid item xs={12} md={4}>
                <ButtonGroup width={1} style={{ marginTop: '-10px' }}>
                  <ActionButton
                    className="action-button dark"
                    disabled={
                      !yvBoostContract || !tokenContract || !!depositsDisabled
                    }
                    handler={() => (willZapIn ? zapperZap() : deposit())}
                    text={
                      vault.hasAllowance || pureEthereum > 0 || willZapIn
                        ? 'Deposit'
                        : 'Approve'
                    }
                    title="Deposit into vault"
                    showTooltip
                    tooltipText={
                      depositsDisabled ||
                      'Connect your wallet to deposit into vault'
                    }
                  />
                </ButtonGroup>
              </Grid>
            </Grid>
          </ActionGroup>

          {zapperError &&
            zapperError.poolAddress === vaultAddress.toLowerCase() && (
              <Box mb={5}>
                <StyledErrorMessage>{zapperError.message}</StyledErrorMessage>
              </Box>
            )}

          <ActionGroup direction={isScreenMd ? 'row' : 'column'}>
            <Grid container spacing={1}>
              <Grid item xs={12} md={12}>
                <Box>
                  <Typography
                    variant="h5"
                    style={{
                      fontSize: '30px',
                      fontWeight: 700,
                      fontStyle: 'normal',
                      textAlign: 'left',
                    }}
                  >
                    Withdraw {vault.displayName}{' '}
                    {selectedWithdrawToken.label === vault.displayName
                      ? null
                      : `denominated to ${selectedWithdrawToken.label}`}
                  </Typography>
                  <Balance
                    amount={vaultBalance}
                    prefix="Vault balance: "
                    suffix="yveCRV"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <Box>
                  <SelectField
                    defaultValue={withdrawTokens[0]}
                    value={selectedWithdrawToken}
                    options={withdrawTokens}
                    onChange={(newValue) => {
                      setSelectedWithdrawToken(newValue);
                    }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <ButtonGroup width={1}>
                  <Box>
                    <AmountField
                      amount={withdrawalAmount}
                      amountSetter={setWithdrawalAmount}
                      gweiAmountSetter={setWithdrawalGweiAmount}
                      maxAmount={vaultBalanceOf}
                      decimals={decimals}
                    />
                  </Box>
                </ButtonGroup>
              </Grid>
              <Grid item xs={12} md={4}>
                <ButtonGroup width={1} style={{ marginTop: '-10px' }}>
                  <ActionButton
                    className="action-button dark"
                    disabled={!vaultContract || !tokenContract}
                    handler={withdraw}
                    text="Withdraw"
                    title="Withdraw from vault"
                    showTooltip
                    tooltipText="Connect your wallet to withdraw from vault"
                  />
                </ButtonGroup>
              </Grid>
            </Grid>
          </ActionGroup>
          {zapperOutError &&
            zapperOutError.poolAddress === vaultAddress.toLowerCase() && (
              <StyledErrorMessage>{zapperOutError.message}</StyledErrorMessage>
            )}
        </Box>
      </Wrapper>
    );
  } else {
    const depositHasBeenApproved =
      (tokenAllowance !== undefined && tokenAllowance !== '0') ||
      pureEthereum > 0 ||
      willZapIn;
    vaultControlsWrapper = (
      <Wrapper>
        <Box display="flex" flexDirection="column" width={1}>
          <ActionGroup
            direction={isScreenMd ? 'row' : 'column'}
            ml={isScreenMd ? '60px' : '0px'}
          >
            <Box display="flex" flexDirection="column">
              <Balance
                amount={
                  isZappable && sellToken ? sellToken.balance : walletBalance
                }
                prefix="Available: "
                decimalPlaces={balanceDecimalPlacesCount}
              />
              <Box
                display="flex"
                flexDirection={isScreenMd ? 'row' : 'column'}
                alignItems="center"
                width={1}
              >
                <Box
                  center
                  mr={isScreenMd ? 5 : 0}
                  width={isScreenMd ? '185px' : '100%'}
                  minWidth={185}
                >
                  <SelectField
                    defaultValue={selectedSellToken}
                    onChange={(value) => {
                      setDepositAmount(0);
                      setSelectedSellToken(value);
                    }}
                    options={
                      isZappable ? supportedTokenOptions : [selectedSellToken]
                    }
                  />
                </Box>
                <ButtonGroup width={1}>
                  <Box width={isScreenMd ? '230px' : '100%'}>
                    <AmountField
                      amount={depositAmount}
                      amountSetter={setDepositAmount}
                      gweiAmountSetter={setDepositGweiAmount}
                      maxAmount={
                        isZappable && sellToken
                          ? sellToken.balanceRaw
                          : tokenBalance
                      }
                      decimals={
                        isZappable && sellToken ? sellToken.decimals : decimals
                      }
                    />
                  </Box>
                  <Box width={isScreenMd ? '130px' : '100%'} ml={5}>
                    <ActionButton
                      disabled={
                        !vaultContract || !tokenContract || !!depositsDisabled
                      }
                      handler={() => (willZapIn ? zapperZap() : deposit())}
                      text={depositHasBeenApproved ? 'Deposit' : 'Approve'}
                      title="Deposit into vault"
                      showTooltipWhenDisabled
                      disabledTooltipText={
                        depositsDisabled ||
                        'Connect your wallet to deposit into vault'
                      }
                      showTooltipWhenEnabled={!depositHasBeenApproved}
                      enabledTooltipText={approvalExplainer}
                    />
                  </Box>
                </ButtonGroup>
              </Box>
              {zapperError &&
                zapperError.poolAddress === vaultAddress.toLowerCase() && (
                  <StyledErrorMessage>{zapperError.message}</StyledErrorMessage>
                )}
            </Box>
          </ActionGroup>

          <ActionGroup
            ml={isScreenMd ? '60px' : '0px'}
            direction={isScreenMd ? 'row' : 'column'}
          >
            <Box display="flex" flexDirection="column">
              <Box
                style={{
                  marginTop: isScreenMd ? '30px' : null,
                  marginBottom: isScreenMd ? '15px' : null,
                  weight: 'bold',
                }}
              >
                <Typography
                  variant="h5"
                  style={{
                    fontSize: '30px',
                    fontWeight: 700,
                    fontStyle: 'normal',
                    textAlign: 'left',
                  }}
                >
                  Withdraw {vault.displayName}{' '}
                  {selectedWithdrawToken.label === vault.displayName
                    ? null
                    : `denominated to ${selectedWithdrawToken.label}`}
                </Typography>
              </Box>
              <Box>
                <Balance
                  amount={vaultBalance}
                  prefix="Vault balance: "
                  decimalPlaces={balanceDecimalPlacesCount}
                  suffix={vault.displayName}
                />
              </Box>
              <Box
                display="flex"
                flexDirection={isScreenMd ? 'row' : 'column'}
                alignItems="center"
                width={1}
              >
                <Box
                  center
                  mr={isScreenMd ? 5 : 0}
                  width={isScreenMd ? '185px' : '100%'}
                  minWidth={185}
                >
                  <AmountField
                    amount={withdrawalAmount}
                    amountSetter={setWithdrawalAmount}
                    gweiAmountSetter={setWithdrawalGweiAmount}
                    maxAmount={vaultBalanceOf}
                    decimals={decimals}
                  />
                </Box>
                <ButtonGroup width={1}>
                  {isScreenMd ? (
                    <Box center mr={15} ml={2} style={{ width: '15px' }}>
                      <SvgArrow />
                    </Box>
                  ) : null}
                  <Box
                    center
                    mr={5}
                    width={isScreenMd ? '185px' : '100%'}
                    minWidth={150}
                  >
                    <SelectField
                      defaultValue={withdrawTokens[0]}
                      value={selectedWithdrawToken}
                      options={withdrawTokens}
                      onChange={(newValue) => {
                        setSelectedWithdrawToken(newValue);
                      }}
                    />
                  </Box>
                  <Box width={isScreenMd ? '130px' : '100%'}>
                    <ActionButton
                      className="action-button bold outline"
                      disabled={!vaultContract || !tokenContract}
                      handler={withdraw}
                      text="Withdraw"
                      title="Withdraw from vault"
                      showTooltipWhenDisabled
                      disabledTooltipText={
                        withdrawDisabled ||
                        'Connect your wallet to withdraw from vault'
                      }
                    />
                  </Box>
                </ButtonGroup>
              </Box>
              {zapperOutError &&
                zapperOutError.poolAddress === vaultAddress.toLowerCase() && (
                  <StyledErrorMessage>
                    {zapperOutError.message}
                  </StyledErrorMessage>
                )}
            </Box>
          </ActionGroup>
        </Box>
      </Wrapper>
    );
  }

  if (isMigratable) {
    vaultControlsWrapper = (
      <Wrapper>
        <Box
          width={isScreenMd ? '160px' : '100%'}
          ml={isScreenMd ? '60px' : '0px'}
        >
          <MigrateVault vaultAddress={vaultAddress} />
        </Box>
        <Box width={isScreenMd ? '160px' : '100%'} ml={5}>
          <ActionButton
            className="action-button dark"
            disabled={!vaultContract || !tokenContract}
            handler={withdrawAll}
            text="Withdraw All"
            title="Withdraw balance from vault"
            showTooltipWhenDisabled
            disabledTooltipText="Connect your wallet to withdraw from vault"
            outlined={1}
          />
        </Box>
      </Wrapper>
    );
  }

  return vaultControlsWrapper;
}

function SelectField({ defaultValue, options, onChange }) {
  return (
    <StyledRoundedSelect
      defaultValue={defaultValue}
      options={options}
      onChange={onChange}
    />
  );
}

function AmountField({
  amount,
  amountSetter,
  gweiAmountSetter,
  maxAmount,
  decimals,
  placeholder,
  disabled,
  hideMaxButton,
  disabledStyle,
}) {
  return (
    <StyledRoundedInput
      value={amount}
      disabledStyle={disabledStyle}
      right={
        hideMaxButton ? null : (
          <MaxButton
            maxAmount={maxAmount}
            amountSetter={amountSetter}
            gweiAmountSetter={gweiAmountSetter}
            decimals={decimals}
          />
        )
      }
      placeholder={placeholder}
      disabled={disabled}
      onChange={(evt) => {
        amountSetter(evt.target.value);

        if (evt.target.value) {
          const gweiAmount = new BigNumber(evt.target.value)
            .multipliedBy(10 ** decimals)
            .toFixed(0);

          gweiAmountSetter(gweiAmount);
        } else {
          gweiAmountSetter(0);
        }
      }}
      maxValue={getNormalizedAmount(maxAmount, decimals)}
    />
  );
}

function MaxButton({ maxAmount, amountSetter, gweiAmountSetter, decimals }) {
  return (
    <MaxWrapper
      onClick={() => {
        const normalizedAmount = new BigNumber(maxAmount)
          .dividedBy(10 ** decimals)
          .toFixed(4, 1);

        amountSetter(normalizedAmount);
        gweiAmountSetter(maxAmount);
      }}
    >
      Max
    </MaxWrapper>
  );
}

function Balance({ amount, prefix, decimalPlaces = 2, hideBalance, suffix }) {
  return (
    <div>
      {prefix}
      {hideBalance ? null : new BigNumber(amount).toFixed(decimalPlaces)}{' '}
      {suffix}
    </div>
  );
}

function ActionButton({
  disabled,
  className,
  handler,
  title,
  text,
  disabledTooltipText,
  enabledTooltipText,
  showTooltipWhenDisabled,
  showTooltipWhenEnabled,
  outlined,
}) {
  return (
    <ButtonFilled
      disabled={disabled}
      className={className}
      onClick={() => handler()}
      color="primary"
      title={title}
      disabledTooltipText={disabledTooltipText}
      showTooltipWhenDisabled={showTooltipWhenDisabled}
      outlined={outlined}
      showTooltipWhenEnabled={showTooltipWhenEnabled}
      enabledTooltipText={enabledTooltipText}
    >
      {text}
    </ButtonFilled>
  );
}
