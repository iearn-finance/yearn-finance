import React from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import Button from '@material-ui/core/Button';
import { withStyles } from '@material-ui/core/styles';
import { useShowDevVaults } from 'containers/Vaults/hooks';

export default function ButtonFilled(props) {
  const {
    onClick,
    disabled,
    children,
    type,
    title,
    onSubmit,
    color,
    tooltipText,
    showTooltip,
  } = props;
  const showDevVaults = useShowDevVaults();

  const ColorButton = withStyles(() => ({
    root: {
      fontFamily: 'Roboto',
      fontSize: '16px',
      padding: '8px 20px 8px 20px',
      margin: color === 'secondary' ? '0px' : '10px 0px',
      width: '100%',
      direction: 'ltr',
      height: '46px',
      textTransform: showDevVaults ? 'inherit' : 'capitalize',
      backgroundColor: color === 'secondary' ? '#999' : '#0657F9',
      color: color === 'secondary' ? '#333' : '#fff',
      '&:hover': {
        backgroundColor: color === 'secondary' ? '#999' : '#0657F9',
      },
      '&:hover.Mui-disabled': {
        backgroundColor: color === 'secondary' ? '#999' : '#0657F9',
      },
      textAlign: 'center',
      '&.Mui-disabled': {
        opacity: 0.5,
        backgroundColor: color === 'secondary' ? '#999' : '#0657F9',
        color: color === 'secondary' ? '#333' : '#fff',
        cursor: 'not-allowed',
        pointerEvents: 'auto',
      },
    },
  }))(Button);

  if (disabled && showTooltip) {
    const adjustedButtonProps = {
      disabled,
      component: disabled ? 'div' : undefined,
      onClick: disabled ? undefined : onClick,
    };
    return (
      <Tooltip title={tooltipText}>
        <ColorButton
          variant="contained"
          color={color}
          onClick={onClick}
          onSubmit={onSubmit}
          type={type}
          disabled={disabled}
          {...adjustedButtonProps}
        >
          {children}
        </ColorButton>
      </Tooltip>
    );
  }
  return (
    <ColorButton
      variant="contained"
      title={title}
      color={color}
      onClick={onClick}
      onSubmit={onSubmit}
      type={type}
      disabled={disabled}
    >
      {children}
    </ColorButton>
  );
}
