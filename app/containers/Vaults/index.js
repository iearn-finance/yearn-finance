import React, { useContext, useEffect } from 'react';
import styled from 'styled-components';
import Hidden from '@material-ui/core/Hidden';
import Accordion from 'react-bootstrap/Accordion';
import VaultsHeader from 'components/VaultsHeader';
import VaultsHeaderDev from 'components/VaultsHeaderDev';
import {
  selectAllContracts,
  selectContractsByTag,
  selectEthBalance,
  selectBackscratcherVault,
  selectOrderedVaults,
} from 'containers/App/selectors';
import { useSelector } from 'react-redux';
import Vault from 'components/Vault';
import { useShowDevVaults } from 'containers/Vaults/hooks';
// import VaultsNavLinks from 'components/VaultsNavLinks';
// import AddVault from 'components/AddVault';
import AccordionContext from 'react-bootstrap/AccordionContext';
import { useWallet, useAccount } from 'containers/ConnectionProvider/hooks';
import LinearProgress from '@material-ui/core/LinearProgress';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import BigNumber from 'bignumber.js';
import Box from 'components/Box';

const Wrapper = styled(Box)`
  margin-top: 20px;
  overflow: auto;
`;

const WrapTable = styled(Box)`
  padding-bottom: 10px;

  div {
    padding-bottom: 0px;
  }
`;

const Warning = styled.div`
  display: table;
  font-size: 29px;
  margin: 0 auto;
  margin-top: 50px;
`;

// const DevHeader = styled.div`
//   opacity: ${(props) => (props.devMode ? 1 : 0)};
//   transition: opacity 100ms ease-in, margin-top 100ms ease-out;
//   margin-top: -50px;
//   pointer-events: none;
//   ${(props) =>
//     props.devMode &&
//     css`
//       margin-top: 30px;
//       color: black;
//       transition: opacity 100ms ease-in, margin-top 100ms ease-out;
//       pointer-events: inherit;
//     `}
// `;

const StyledAccordion = styled(Accordion)`
  padding-bottom: 10px;
  width: 100%;
`;

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = React.useState(config);

  const sortedItems = React.useMemo(() => {
    const sortableItems = Object.values(items);
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key) => {
    let direction = 'descending';
    let newKey = key;
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'descending'
    ) {
      direction = 'ascending';
    } else if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      newKey = null;
      direction = null;
    }
    setSortConfig({ key: newKey, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const Vaults = (props) => {
  const { history } = props;
  const isScreenMd = useMediaQuery('(min-width:960px)');
  const showDevVaults = useShowDevVaults();
  const wallet = useWallet();
  const account = useAccount();
  const walletConnected = wallet.provider && account;
  const orderedVaults = useSelector(selectOrderedVaults);
  const localContracts = useSelector(selectContractsByTag('localContracts'));
  const backscratcherVault = useSelector(selectBackscratcherVault());
  const allContracts = useSelector(selectAllContracts());
  const ethBalance = useSelector(selectEthBalance());

  let vaultItems = showDevVaults ? localContracts : orderedVaults;

  vaultItems = _.map(vaultItems, (vault) => {
    const vaultContractData = allContracts[vault.address];
    const newVault = _.merge(vault, vaultContractData);

    const { decimals } = vault;

    const { balanceOf, getPricePerFullShare, pricePerShare } = newVault;

    // Value Deposited
    const v2Vault = vault.type === 'v2' || vault.apiVersion;
    let vaultBalanceOf;
    if (v2Vault) {
      vaultBalanceOf = balanceOf
        ? new BigNumber(balanceOf[0].value)
            .dividedBy(10 ** decimals)
            .multipliedBy(pricePerShare[0].value / 10 ** decimals)
            .toNumber()
        : 0;
    } else {
      vaultBalanceOf = balanceOf
        ? new BigNumber(balanceOf[0].value)
            .dividedBy(10 ** decimals)
            .multipliedBy(getPricePerFullShare[0].value / 10 ** 18)
            .toNumber()
        : 0;
    }
    newVault.valueDeposited = vaultBalanceOf || 0;

    // Growth
    newVault.valueApy = _.get(newVault, 'apy.recommended');

    // Total Assets
    let vaultAssets =
      _.get(newVault, 'balance[0].value') ||
      _.get(newVault, 'totalAssets[0].value');
    vaultAssets = new BigNumber(vaultAssets)
      .dividedBy(10 ** decimals)
      .toNumber();
    newVault.valueTotalAssets = vaultAssets;

    // Available to Deposit
    const tokenContractAddress = vault.tokenAddress || vault.token || vault.CRV;
    const tokenContractData = allContracts[tokenContractAddress];
    const tokenBalance = vault.pureEthereum
      ? ethBalance
      : _.get(tokenContractData, 'balanceOf[0].value');
    const tokenBalanceOf = tokenBalance
      ? new BigNumber(tokenBalance).dividedBy(10 ** decimals).toNumber()
      : 0;
    newVault.valueAvailableToDeposit = tokenBalanceOf || 0;

    return newVault;
  });

  const { items, requestSort, sortConfig } = useSortableData(vaultItems);

  useEffect(() => {
    requestSort('valueDeposited');
  }, []);

  // Show the vault based on URL path
  const pathArray = history.location.pathname.split('/');
  const showAccordionKey = pathArray[2] || '';

  useEffect(() => {
    // Scroll to the vault
    if (showAccordionKey && orderedVaults) {
      const anchor = `vault-${showAccordionKey}`;
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [orderedVaults]);

  let columnHeader;
  let backscratcherWrapper;
  if (showDevVaults) {
    columnHeader = <VaultsHeaderDev />;
  } else {
    columnHeader = (
      <VaultsHeader requestSort={requestSort} sortConfig={sortConfig} />
    );
  }

  let warning;
  if (showDevVaults) {
    warning = <Warning>Experimental vaults. Use at your own risk.</Warning>;
  } else if (backscratcherVault) {
    backscratcherWrapper = (
      <WrapTable center width={1}>
        <Hidden smDown>{<VaultsHeader backscratcher />}</Hidden>

        <StyledAccordion defaultActiveKey={backscratcherVault.address}>
          <BackscratchersWrapper
            showDevVaults={showDevVaults}
            walletConnected={walletConnected}
          />
        </StyledAccordion>
      </WrapTable>
    );
  }

  const linkToVault = (accordionKey) => {
    const path = accordionKey || '';
    history.push(`/vaults/${path}`);
  };

  return (
    <Wrapper center mx={isScreenMd ? 0 : [16, 32]}>
      <Box
        width={isScreenMd ? '90%' : '100%'}
        minWidth={isScreenMd ? 940 : null}
        maxWidth={1200}
        center
      >
        {/* <DevHeader devMode={devMode}>
        <VaultsNavLinks />
        <AddVault devVaults={showDevVaults} />
      </DevHeader> */}
        {warning}
        {backscratcherWrapper}
        <WrapTable center width={1}>
          <Hidden smDown>{columnHeader}</Hidden>
          <StyledAccordion
            onSelect={linkToVault}
            defaultActiveKey={showAccordionKey}
          >
            <VaultsWrapper
              vaultItems={items}
              showDevVaults={showDevVaults}
              walletConnected={walletConnected}
            />
          </StyledAccordion>
        </WrapTable>
      </Box>
    </Wrapper>
  );
};

const BackscratchersWrapper = (props) => {
  const { showDevVaults, walletConnected } = props;
  const backscratcherVault = useSelector(selectBackscratcherVault());
  const currentEventKey = useContext(AccordionContext);
  const multiplier = _.get(backscratcherVault, 'apy.data.currentBoost');
  const multiplierText = `${multiplier.toFixed(2)}x`;
  backscratcherVault.multiplier = multiplierText;
  backscratcherVault.apy.recommended = backscratcherVault.apy.data.totalApy;
  const renderVault = (vault) => {
    const vaultKey = vault.address;
    return (
      <Vault
        vault={vault}
        key={vaultKey}
        accordionKey={vaultKey}
        active={currentEventKey === vaultKey}
        showDevVaults={showDevVaults}
        backscratcherVault
      />
    );
  };

  // Show Linear progress when orderedvaults is empty
  if (walletConnected && backscratcherVault == null) return <LinearProgress />;
  let vaultRows;
  if (!backscratcherVault) {
    vaultRows = [];
  } else {
    vaultRows = _.map([backscratcherVault], renderVault);
  }

  return <React.Fragment>{vaultRows}</React.Fragment>;
};

const VaultsWrapper = (props) => {
  const { showDevVaults, walletConnected, vaultItems } = props;
  const currentEventKey = useContext(AccordionContext);

  const renderVault = (vault) => {
    let vaultKey = vault.address;
    if (vault.pureEthereum) {
      vaultKey = `${vault.address}-eth`;
    }
    return (
      <Vault
        vault={vault}
        key={vaultKey}
        accordionKey={vaultKey}
        active={currentEventKey === vaultKey}
        showDevVaults={showDevVaults}
      />
    );
  };

  // Show Linear progress when orderedvaults is empty
  if (walletConnected && vaultItems == null) return <LinearProgress />;
  const vaultRows = _.map(vaultItems, renderVault);
  return <React.Fragment>{vaultRows}</React.Fragment>;
};

Vaults.whyDidYouRender = true;
export default Vaults;
