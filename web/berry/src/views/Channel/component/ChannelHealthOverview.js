import PropTypes from 'prop-types';
import { Box, Card, Grid, Typography, Skeleton } from '@mui/material';
import { IconServer, IconServerOff, IconCash, IconActivity } from '@tabler/icons-react';
import { alpha } from '@mui/material/styles';

const StatCard = ({ icon: Icon, label, value, color, isLoading }) => (
    <Box
        className="shadow-premium-hover"
        sx={{
            p: 2.5,
            borderRadius: 2,
            background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette[color].lighter, 0.8)} 0%, ${alpha(theme.palette[color].light, 0.6)} 100%)`,
            backdropFilter: 'blur(8px)',
            border: 1,
            borderColor: (theme) => alpha(theme.palette[color].main, 0.15),
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette[color].main, 0.25)}`,
                background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette[color].lighter, 1)} 0%, ${alpha(theme.palette[color].light, 0.9)} 100%)`
            }
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: (theme) => alpha(theme.palette[color].main, 0.12),
                    color: `${color}.main`
                }}
            >
                <Icon size={22} />
            </Box>
            <Box>
                {isLoading ? (
                    <>
                        <Skeleton width={60} height={28} />
                        <Skeleton width={80} height={16} />
                    </>
                ) : (
                    <>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: `${color}.dark` }}>
                            {value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {label}
                        </Typography>
                    </>
                )}
            </Box>
        </Box>
    </Box>
);

const ChannelHealthOverview = ({ channels, isLoading }) => {
    const activeCount = channels.filter(c => c.status === 1).length;
    const disabledCount = channels.filter(c => c.status !== 1).length;

    const totalBalance = channels.reduce((sum, c) => {
        // Normalize balance based on type
        if ([1, 8].includes(c.type)) return sum + c.balance; // USD
        if ([4, 5, 12, 36, 44].includes(c.type)) return sum + (c.balance / 7); // CNY to USD approx
        return sum;
    }, 0);

    const avgResponseTime = channels.length > 0
        ? Math.round(
            channels
                .filter(c => c.response_time > 0)
                .reduce((sum, c) => sum + c.response_time, 0) /
            channels.filter(c => c.response_time > 0).length || 0
        )
        : 0;

    return (
        <Card className="glass-card" sx={{ mb: 3, p: 2.5, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                渠道概览
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        icon={IconServer}
                        label="活跃渠道"
                        value={activeCount}
                        color="success"
                        isLoading={isLoading}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        icon={IconServerOff}
                        label="禁用渠道"
                        value={disabledCount}
                        color="warning"
                        isLoading={isLoading}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        icon={IconCash}
                        label="总余额 (约)"
                        value={`$${totalBalance.toFixed(0)}`}
                        color="info"
                        isLoading={isLoading}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <StatCard
                        icon={IconActivity}
                        label="平均响应"
                        value={avgResponseTime > 0 ? `${avgResponseTime}ms` : '--'}
                        color="primary"
                        isLoading={isLoading}
                    />
                </Grid>
            </Grid>
        </Card>
    );
};

ChannelHealthOverview.propTypes = {
    channels: PropTypes.array,
    isLoading: PropTypes.bool
};

ChannelHealthOverview.defaultProps = {
    channels: [],
    isLoading: false
};

export default ChannelHealthOverview;
