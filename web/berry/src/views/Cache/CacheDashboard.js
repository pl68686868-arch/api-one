import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Card,
    CardContent,
    Grid,
    Typography,
    Box,
    Switch,
    FormControlLabel,
    Button,
    LinearProgress,
    Chip,
    Divider,
    Alert,
    CircularProgress,
    Tooltip
} from '@mui/material';
import { IconDatabase, IconBrain, IconTrash, IconRefresh, IconTrendingUp, IconCoin } from '@tabler/icons-react';
import { showError, showSuccess } from 'utils/common';
import { API } from 'utils/api';

// Stat Card Component
const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card
        sx={{
            height: '100%',
            background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
            border: `1px solid ${color}30`
        }}
    >
        <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color={color}>
                        {value}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: `${color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {icon}
                </Box>
            </Box>
        </CardContent>
    </Card>
);

StatCard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    icon: PropTypes.node.isRequired,
    color: PropTypes.string.isRequired,
    subtitle: PropTypes.string
};

// Hit Rate Progress Bar
const HitRateBar = ({ rate }) => {
    const percentage = (rate * 100).toFixed(1);
    let color = 'error';
    if (rate >= 0.5) color = 'success';
    else if (rate >= 0.3) color = 'warning';

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Cache Hit Rate</Typography>
                <Typography variant="body2" fontWeight="bold" color={`${color}.main`}>
                    {percentage}%
                </Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={Math.min(rate * 100, 100)}
                color={color}
                sx={{ height: 10, borderRadius: 5 }}
            />
        </Box>
    );
};

HitRateBar.propTypes = {
    rate: PropTypes.number.isRequired
};

// Main Cache Dashboard Component
const CacheDashboard = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [clearing, setClearing] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const response = await API.get('/api/cache/stats');
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch cache stats:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchStats]);

    const handleToggle = async (type, enabled) => {
        setToggling(true);
        try {
            const response = await API.post('/api/cache/toggle', { type, enabled });
            if (response.data.success) {
                showSuccess(response.data.message);
                fetchStats();
            } else {
                showError(response.data.message);
            }
        } catch (error) {
            showError('Failed to toggle cache');
        } finally {
            setToggling(false);
        }
    };

    const handleClear = async (type) => {
        if (!window.confirm(`Are you sure you want to clear ${type} cache?`)) {
            return;
        }

        setClearing(true);
        try {
            const response = await API.post('/api/cache/clear', { type });
            if (response.data.success) {
                showSuccess(`Cleared ${response.data.cleared} cache entries`);
                fetchStats();
            } else {
                showError(response.data.message);
            }
        } catch (error) {
            showError('Failed to clear cache');
        } finally {
            setClearing(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!stats) {
        return (
            <Alert severity="warning">
                Failed to load cache statistics. Make sure cache is configured.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">
                        {t('cache.dashboard.title', 'LLM Response Cache')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('cache.dashboard.subtitle', 'Monitor and manage response caching for faster responses and lower costs')}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<IconRefresh />}
                    onClick={fetchStats}
                    disabled={loading}
                >
                    {t('common.refresh', 'Refresh')}
                </Button>
            </Box>

            {/* Main Stats */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('cache.stats.hitRate', 'Hit Rate')}
                        value={`${(stats.hit_rate * 100).toFixed(1)}%`}
                        icon={<IconTrendingUp size={24} color="#4caf50" />}
                        color="#4caf50"
                        subtitle={`${stats.total_hits.toLocaleString()} hits / ${(stats.total_hits + stats.total_misses).toLocaleString()} total`}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('cache.stats.tokensSaved', 'Tokens Saved')}
                        value={stats.tokens_saved.toLocaleString()}
                        icon={<IconDatabase size={24} color="#2196f3" />}
                        color="#2196f3"
                        subtitle="Total tokens not sent to LLM"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('cache.stats.costSaved', 'Est. Cost Saved')}
                        value={`$${stats.est_cost_saved.toFixed(2)}`}
                        icon={<IconCoin size={24} color="#ff9800" />}
                        color="#ff9800"
                        subtitle="Based on $0.002/1K tokens"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title={t('cache.stats.semanticEntries', 'Semantic Entries')}
                        value={stats.semantic_cache_entries.toLocaleString()}
                        icon={<IconBrain size={24} color="#9c27b0" />}
                        color="#9c27b0"
                        subtitle={`Max: ${stats.semantic_cache_max_size.toLocaleString()}`}
                    />
                </Grid>
            </Grid>

            {/* Hit Rate Progress */}
            <Card sx={{ mb: 3, p: 2 }}>
                <HitRateBar rate={stats.hit_rate} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Target: 30%+ for cost efficiency, 50%+ for excellent performance
                </Typography>
            </Card>

            {/* Cache Controls */}
            <Grid container spacing={3}>
                {/* Exact Match Cache */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IconDatabase size={20} />
                                    <Typography variant="h6">Exact Match Cache</Typography>
                                </Box>
                                <Chip
                                    label={stats.exact_cache_enabled ? 'Enabled' : 'Disabled'}
                                    color={stats.exact_cache_enabled ? 'success' : 'default'}
                                    size="small"
                                />
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Caches identical requests using SHA256 hash. TTL: {stats.exact_cache_ttl}s
                            </Typography>

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={stats.exact_cache_enabled}
                                            onChange={(e) => handleToggle('exact', e.target.checked)}
                                            disabled={toggling}
                                        />
                                    }
                                    label="Enable"
                                />
                                <Tooltip title="Clear all exact match cache entries">
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        size="small"
                                        startIcon={<IconTrash size={16} />}
                                        onClick={() => handleClear('exact')}
                                        disabled={clearing}
                                    >
                                        Clear
                                    </Button>
                                </Tooltip>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Semantic Cache */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IconBrain size={20} />
                                    <Typography variant="h6">Semantic Cache</Typography>
                                </Box>
                                <Chip
                                    label={stats.semantic_cache_enabled ? 'Enabled' : 'Disabled'}
                                    color={stats.semantic_cache_enabled ? 'success' : 'default'}
                                    size="small"
                                />
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Matches similar queries using vector similarity. Threshold: {(stats.semantic_cache_threshold * 100).toFixed(0)}%
                            </Typography>

                            <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Entries: {stats.semantic_cache_entries} / {stats.semantic_cache_max_size}
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={(stats.semantic_cache_entries / stats.semantic_cache_max_size) * 100}
                                    sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                                />
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={stats.semantic_cache_enabled}
                                            onChange={(e) => handleToggle('semantic', e.target.checked)}
                                            disabled={toggling}
                                        />
                                    }
                                    label="Enable"
                                />
                                <Tooltip title="Clear all semantic cache entries">
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        size="small"
                                        startIcon={<IconTrash size={16} />}
                                        onClick={() => handleClear('semantic')}
                                        disabled={clearing}
                                    >
                                        Clear
                                    </Button>
                                </Tooltip>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                    <strong>Environment Variables:</strong> Set <code>RESPONSE_CACHE_ENABLED=true</code> and <code>SEMANTIC_CACHE_ENABLED=true</code> in your deployment to enable caching on startup.
                </Typography>
            </Alert>
        </Box>
    );
};

export default CacheDashboard;
