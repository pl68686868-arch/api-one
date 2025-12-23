import { useState, useEffect } from 'react';
import { Grid, Typography, Box, Card, CardContent, Chip, LinearProgress, CircularProgress, Alert } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { IconCheck, IconAlertTriangle, IconX, IconBolt, IconClock, IconServer } from '@tabler/icons-react';

// API helper
const fetchIntelligenceData = async (endpoint) => {
    const response = await fetch(`/api/intelligence/${endpoint}`);
    const data = await response.json();
    return data.success ? data.data : null;
};

// Status indicator component
const StatusIndicator = ({ status }) => {
    const theme = useTheme();

    const statusConfig = {
        healthy: { color: theme.palette.success.main, icon: IconCheck, label: 'Healthy' },
        degraded: { color: theme.palette.warning.main, icon: IconAlertTriangle, label: 'Degraded' },
        down: { color: theme.palette.error.main, icon: IconX, label: 'Down' },
        unknown: { color: theme.palette.grey[500], icon: IconServer, label: 'Unknown' }
    };

    const config = statusConfig[status] || statusConfig.unknown;
    const Icon = config.icon;

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                backgroundColor: alpha(config.color, 0.1),
                color: config.color,
                fontWeight: 600,
                fontSize: '0.75rem'
            }}
        >
            <Icon size={14} />
            {config.label}
        </Box>
    );
};

// Provider health card
const ProviderCard = ({ provider }) => {
    const theme = useTheme();

    return (
        <Card
            sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`
                }
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {provider.provider}
                    </Typography>
                    <StatusIndicator status={provider.status} />
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Success Rate</Typography>
                        <Typography variant="body2" fontWeight={600}>
                            {(provider.success_rate * 100).toFixed(1)}%
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={provider.success_rate * 100}
                        sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                backgroundColor:
                                    provider.success_rate >= 0.95
                                        ? theme.palette.success.main
                                        : provider.success_rate >= 0.8
                                            ? theme.palette.warning.main
                                            : theme.palette.error.main
                            }
                        }}
                    />
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <IconClock size={14} />
                                <Typography variant="body2" color="text.secondary">Latency</Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {provider.avg_latency_ms}ms
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                <IconServer size={14} />
                                <Typography variant="body2" color="text.secondary">Channels</Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {provider.channel_count}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                        {provider.request_count.toLocaleString()} requests
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

// Stats overview card
const StatsCard = ({ stats }) => {
    const theme = useTheme();

    if (!stats) return null;

    return (
        <Card
            sx={{
                mb: 3,
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                color: 'white'
            }}
        >
            <CardContent>
                <Grid container spacing={3}>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>Total Requests</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {stats.total_requests.toLocaleString()}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>Success Rate</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {(stats.overall_success_rate * 100).toFixed(1)}%
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>Avg Latency</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {stats.avg_latency_ms}ms
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>Channels</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                                <Chip label={`${stats.healthy_channels} ✓`} size="small" sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                                <Chip label={`${stats.degraded_channels} ⚠`} size="small" sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                                <Chip label={`${stats.down_channels} ✗`} size="small" sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

// Main Intelligence Dashboard
const IntelligenceDashboard = () => {
    const theme = useTheme();
    const [providers, setProviders] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [providersData, statsData] = await Promise.all([
                    fetchIntelligenceData('health'),
                    fetchIntelligenceData('stats')
                ]);
                setProviders(providersData || []);
                setStats(statsData);
            } catch (err) {
                setError('Failed to load intelligence data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        // Refresh every 30 seconds
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconBolt size={32} color={theme.palette.primary.main} />
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        AI Intelligence Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Real-time provider health and routing intelligence
                    </Typography>
                </Box>
            </Box>

            {/* Stats Overview */}
            <StatsCard stats={stats} />

            {/* Provider Health Grid */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                🏥 Provider Health
            </Typography>

            {providers.length === 0 ? (
                <Alert severity="info">No provider health data available yet. Data will appear after requests are made.</Alert>
            ) : (
                <Grid container spacing={3}>
                    {providers.map((provider) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={provider.provider}>
                            <ProviderCard provider={provider} />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

export default IntelligenceDashboard;
