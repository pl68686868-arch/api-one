import PropTypes from 'prop-types';
import { Chip, Tooltip } from '@mui/material';
import { IconCircleCheck, IconCircleX, IconAlertCircle } from '@tabler/icons-react';

const STATUS_CONFIG = {
  1: {
    label: '启用',
    color: 'success',
    icon: IconCircleCheck,
    tooltip: '渠道已启用，正常运行中'
  },
  2: {
    label: '手动禁用',
    color: 'warning', 
    icon: IconAlertCircle,
    tooltip: '渠道已被手动禁用'
  },
  3: {
    label: '自动禁用',
    color: 'error',
    icon: IconCircleX,
    tooltip: '渠道因错误被系统自动禁用'
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
