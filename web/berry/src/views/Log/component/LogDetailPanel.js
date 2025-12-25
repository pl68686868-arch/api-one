import PropTypes from 'prop-types';
import {
    Box,
    Grid,
    Typography,
    Chip,
    Divider,
    Stack,
    Tooltip,
    IconButton,
    alpha
} from '@mui/material';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { useState } from 'react';

// Helper component for info rows
const InfoRow = ({ label, value, copyable }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                {label}:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {value}
            </Typography>
            {copyable && (
                <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                    <IconButton size="small" onClick={handleCopy}>
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </IconButton>
                </Tooltip>
            )}
        </Stack>
    );
};

InfoRow.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.node]),
    copyable: PropTypes.bool
};

// Metric display component
const Metric = ({ label, value, color = 'default' }) => (
    <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" display="block">
            {label}
        </Typography>
        <Chip
            label={value}
            color={color}
            size="small"
            sx={{ mt: 0.5, fontWeight: 600 }}
        />
    </Box>
);

Metric.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    color: PropTypes.string
};

// Main detail panel component
export default function LogDetailPanel({ item }) {
    // Try to parse selection_reason as JSON (backward compatibility)
    // New format is plain text, old format may be JSON
    let selectionReason = null;
    let selectionReasonText = item.selection_reason || null;

    try {
        if (item.selection_reason && item.selection_reason.startsWith('{')) {
            selectionReason = JSON.parse(item.selection_reason);
            selectionReasonText = null; // Use structured data instead
        }
    } catch (e) {
        // Not JSON, treat as plain text
    }

    return (
        <Grid container spacing={3}>
            {/* Request Information */}
            <Grid item xs={12} md={(selectionReason || selectionReasonText || item.actual_model) ? 6 : 12}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Request Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <InfoRow label="Request ID" value={item.request_id || 'N/A'} copyable={!!item.request_id} />
                    <InfoRow
                        label="Elapsed Time"
                        value={item.elapsed_time > 0 ? `${item.elapsed_time}ms` : 'N/A'}
                    />
                    <InfoRow label="Streaming" value={item.is_stream ? 'Yes' : 'No'} />
                    <InfoRow label="Prompt Tokens" value={item.prompt_tokens || 0} />
                    <InfoRow label="Completion Tokens" value={item.completion_tokens || 0} />

                    {/* Model Information */}
                    {(item.virtual_model || item.actual_model) && (
                        <>
                            <Divider sx={{ my: 1 }} />
                            {item.virtual_model && (
                                <>
                                    <InfoRow label="Virtual Model" value={item.virtual_model} />
                                    <InfoRow label="Resolved To" value={item.resolved_model || item.model_name} />
                                </>
                            )}
                            {item.actual_model && item.actual_model !== item.model_name && (
                                <InfoRow
                                    label="Actual Model"
                                    value={item.actual_model}
                                    copyable={true}
                                />
                            )}
                        </>
                    )}
                </Box>
            </Grid>

            {/* Channel Selection Details - New Format (Plain Text) */}
            {(selectionReasonText || !!item.channel_health_score) && (
                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Channel Selection
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {selectionReasonText && (
                            <Box
                                sx={{
                                    p: 1.5,
                                    bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.1),
                                    borderRadius: 1,
                                    border: 1,
                                    borderColor: 'primary.light'
                                }}
                            >
                                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                                    {selectionReasonText}
                                </Typography>
                            </Box>
                        )}

                        {item.channel_health_score && item.channel_health_score > 0 && (
                            <InfoRow
                                label="Health Score"
                                value={
                                    <Chip
                                        label={`${(item.channel_health_score * 100).toFixed(1)}%`}
                                        color={item.channel_health_score > 0.95 ? 'success' : item.channel_health_score > 0.8 ? 'warning' : 'error'}
                                        size="small"
                                        sx={{ fontWeight: 600 }}
                                    />
                                }
                            />
                        )}
                    </Box>
                </Grid>
            )}

            {/* Smart Selection Details - Old Format (JSON) */}
            {selectionReason && (
                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Smart Selection Analysis
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                                Strategy:
                            </Typography>
                            <Chip
                                label={selectionReason.strategy || 'Unknown'}
                                color="secondary"
                                size="small"
                            />
                        </Stack>

                        {selectionReason.selected_channel_name && (
                            <InfoRow
                                label="Selected Channel"
                                value={`${selectionReason.selected_channel_name} (ID: ${selectionReason.selected_channel_id || 'N/A'})`}
                            />
                        )}

                        {selectionReason.channel_score && (
                            <InfoRow
                                label="Channel Score"
                                value={selectionReason.channel_score.toFixed(2)}
                            />
                        )}

                        {/* Channel Health Metrics */}
                        {selectionReason.channel_health && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    Channel Health Metrics
                                </Typography>
                                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                                    <Grid item xs={4}>
                                        <Metric
                                            label="Success Rate"
                                            value={`${(selectionReason.channel_health.success_rate * 100).toFixed(1)}%`}
                                            color={selectionReason.channel_health.success_rate > 0.95 ? 'success' : 'warning'}
                                        />
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Metric
                                            label="Avg Latency"
                                            value={`${selectionReason.channel_health.avg_latency_ms}ms`}
                                            color="info"
                                        />
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Metric
                                            label="Total Requests"
                                            value={selectionReason.channel_health.total_requests}
                                        />
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        {/* Alternatives Considered */}
                        {selectionReason.alternatives_considered && selectionReason.alternatives_considered.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    Alternatives Considered
                                </Typography>
                                {selectionReason.alternatives_considered.map((alt, idx) => (
                                    <Box
                                        key={idx}
                                        sx={{
                                            mt: 1,
                                            p: 1,
                                            bgcolor: 'action.hover',
                                            borderRadius: 1,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Typography variant="body2">
                                            Channel {alt.channel_id} ({alt.model})
                                        </Typography>
                                        <Chip label={`Score: ${alt.score.toFixed(2)}`} size="small" />
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                </Grid>
            )}

            {/* Full Content/Details */}
            {item.content && (
                <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Request Content
                    </Typography>
                    <Box
                        sx={{
                            p: 2,
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'divider',
                            maxHeight: 300,
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {item.content}
                    </Box>
                </Grid>
            )}
        </Grid>
    );
}

LogDetailPanel.propTypes = {
    item: PropTypes.object.isRequired
};
