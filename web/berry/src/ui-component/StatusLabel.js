import PropTypes from 'prop-types';
import { Chip, Tooltip } from '@mui/material';
import { IconCircleCheck, IconCircleX, IconAlertCircle } from '@tabler/icons-react';

const STATUS_CONFIG = {
  1: {
    label: 'Enable',
    color: 'success',
    icon: IconCircleCheck,
    tooltip: 'Channel enabled, running normally'
  },
  2: {
    label: 'Manually Disabled',
    color: 'warning', 
    icon: IconAlertCircle,
    tooltip: 'Channel manually disabled'
  },
  3: {
    label: 'Auto Disabled',
    color: 'error',
    icon: IconCircleX,
    tooltip: 'Channel auto-disabled by system error'
  }
};

const StatusLabel = ({ status, onClick, size = 'small' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[3];
  const IconComponent = config.icon;

  return (
    <Tooltip title={config.tooltip} placement="top" arrow>
      <Chip
        icon={<IconComponent size={16} />}
        label={config.label}
        color={config.color}
        size={size}
        variant="outlined"
        onClick={onClick}
        sx={{
          cursor: onClick ? 'pointer' : 'default',
          fontWeight: 500,
          transition: 'all 0.2s ease',
          '&:hover': onClick ? {
            transform: 'scale(1.02)',
            boxShadow: 1
          } : {}
        }}
      />
    </Tooltip>
  );
};

StatusLabel.propTypes = {
  status: PropTypes.oneOf([1, 2, 3]).isRequired,
  onClick: PropTypes.func,
  size: PropTypes.oneOf(['small', 'medium'])
};

export default StatusLabel;
