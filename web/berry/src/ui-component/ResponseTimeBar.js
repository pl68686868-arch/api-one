import PropTypes from 'prop-types';
import { Box, Typography, Tooltip } from '@mui/material';
import { IconClick } from '@tabler/icons-react';

const getLatencyColor = (ms) => {
    if (ms < 500) return 'success.main';
    if (ms < 1000) return 'warning.main';
    if (ms < 2000) return 'orange.main';
    return 'error.main';
};

const getLatencyLabel = (ms) => {
    if (ms < 500) return '极快';
    if (ms < 1000) return '正常';
    if (ms < 2000) return '较慢';
    return '很慢';
};

const formatTime = (timestamp) => {
    if (!timestamp) return '未测试';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const ResponseTimeBar = ({ responseTime, testTime, onClick }) => {
    const hasData = responseTime > 0 && testTime > 0;
    const barWidth = hasData ? Math.min((responseTime / 20), 100) : 0; // Scale: 2000ms = 100%

    if (!hasData) {
        return (
            <Tooltip title="点击测试渠道响应时间" arrow>
                <Box
                    onClick={onClick}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                        color: 'text.secondary',
                        '&:hover': {
                            color: 'primary.main'
                        }
                    }}
                >
                    <IconClick size={16} />
                    <Typography variant="caption">点击测试</Typography>
                </Box>
            </Tooltip>
        );
    }

    return (
        <Tooltip
            title={`最后测试: ${formatTime(testTime)} | ${getLatencyLabel(responseTime)}`}
            arrow
            placement="top"
        >
            <Box
                onClick={onClick}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    minWidth: 100,
                    '&:hover': {
                        '& .bar': {
                            transform: 'scaleY(1.3)'
                        }
                    }
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        height: 6,
                        bgcolor: 'action.hover',
                        borderRadius: 3,
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <Box
                        className="bar"
                        sx={{
                            width: `${barWidth}%`,
                            height: '100%',
                            bgcolor: getLatencyColor(responseTime),
                            borderRadius: 3,
                            transition: 'all 0.3s ease',
                            background: (theme) =>
                                `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette[responseTime > 1000 ? 'error' : responseTime > 500 ? 'warning' : 'success'].main} 100%)`
                        }}
                    />
                </Box>
                <Typography
                    variant="caption"
                    sx={{
                        fontWeight: 600,
                        color: getLatencyColor(responseTime),
                        minWidth: 45,
                        textAlign: 'right'
                    }}
                >
                    {responseTime}ms
                </Typography>
            </Box>
        </Tooltip>
    );
};

ResponseTimeBar.propTypes = {
    responseTime: PropTypes.number,
    testTime: PropTypes.number,
    onClick: PropTypes.func
};

ResponseTimeBar.defaultProps = {
    responseTime: 0,
    testTime: 0
};

export default ResponseTimeBar;
