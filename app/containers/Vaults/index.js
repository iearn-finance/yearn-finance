import React, { useContext } from 'react';
import styled, { css } from 'styled-components';
import tw from 'twin.macro';
import Accordion from 'react-bootstrap/Accordion';
import VaultsHeader from 'components/VaultsHeader';
import VaultsHeaderDev from 'components/VaultsHeaderDev';
import BackscratchersHeaders from 'components/BackscratchersHeaders';
import {
  selectContractsByTag,
  selectBackscratcherVault,
  selectOrderedVaults,
} from 'containers/App/selectors';
import { useSelector } from 'react-redux';
import Vault from 'components/Vault';
import VaultsNavLinks from 'components/VaultsNavLinks';
import { useShowDevVaults } from 'containers/Vaults/hooks';
import AddVault from 'components/AddVault';
import AccordionContext from 'react-bootstrap/AccordionContext';
import { useWallet, useAccount } from 'containers/ConnectionProvider/hooks';
import LinearProgress from '@material-ui/core/LinearProgress';

const Wrapper = styled.div`
  margin: 0 auto;
  @media (min-width: 768px) {
    width: 1088px;
  }
`;

const WrapTable = styled.div`
  ${tw`w-5/6 md:w-full m-0 m-auto md:overflow-x-auto overflow-x-scroll whitespace-nowrap`};
`;
const Warning = styled.div`
  display: table;
  font-size: 29px;
  margin: 0 auto;
  margin-top: 50px;
`;

const DevHeader = styled.div`
  opacity: ${(props) => (props.devMode ? 1 : 0)};
  transition: opacity 100ms ease-in, margin-top 100ms ease-out;
  margin-top: -50px;
  pointer-events: none;
  ${(props) =>
    props.devMode &&
    css`
      margin-top: 30px;
      color: black;
      transition: opacity 100ms ease-in, margin-top 100ms ease-out;
      pointer-events: inherit;
    `}
`;

const StyledAccordion = styled(Accordion)`
  width: 1085px;
`;

const Vaults = () => {
  const devMode = true;
  const showDevVaults = useShowDevVaults();
  const wallet = useWallet();
  const account = useAccount();
  const walletConnected = wallet.provider && account;
  const backscratcherVault = useSelector(selectBackscratcherVault());
  let columnHeader;
  let backscratcherWrapper;

  if (showDevVaults) {
    columnHeader = <VaultsHeaderDev />;
  } else {
    columnHeader = <VaultsHeader />;
  }

  let warning;
  if (showDevVaults) {
    warning = <Warning>Experimental vaults. Use at your own risk.</Warning>;
  } else if (backscratcherVault) {
    backscratcherWrapper = (
      <WrapTable>
        <BackscratchersHeaders />
        <StyledAccordion defaultActiveKey={backscratcherVault.address}>
          <BackscratchersWrapper
            showDevVaults={showDevVaults}
            walletConnected={walletConnected}
          />
        </StyledAccordion>
      </WrapTable>
    );
  }

  return (
    <Wrapper>
      <DevHeader devMode={devMode}>
        <VaultsNavLinks />
        <AddVault devVaults={showDevVaults} />
      </DevHeader>
      {warning}

      {backscratcherWrapper}

      <WrapTable>
        {columnHeader}
        <StyledAccordion>
          <VaultsWrapper
            showDevVaults={showDevVaults}
            walletConnected={walletConnected}
          />
        </StyledAccordion>
      </WrapTable>
    </Wrapper>
  );
};

const BackscratchersWrapper = (props) => {
  const { showDevVaults, walletConnected } = props;
  const backscratcherVault = useSelector(selectBackscratcherVault());
  const currentEventKey = useContext(AccordionContext);

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
  const { showDevVaults, walletConnected } = props;
  const orderedVaults = useSelector(selectOrderedVaults);
  const localContracts = useSelector(selectContractsByTag('localContracts'));
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
  if (walletConnected && orderedVaults == null) return <LinearProgress />;

  let vaultRows = _.map(orderedVaults, renderVault);
  if (showDevVaults) {
    vaultRows = _.map(localContracts, renderVault);
  }

  return <React.Fragment>{vaultRows}</React.Fragment>;
};

Vaults.whyDidYouRender = true;
export default Vaults;
