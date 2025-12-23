import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  Button,
  Autocomplete,
  TextField,
  Collapse,
  Alert
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// Quick templates for common mappings
const MAPPING_TEMPLATES = {
  latest: {
    name: '🔄 Latest',
    description: 'Map to newest model versions',
    mappings: {
      'gpt-4': 'gpt-4o-2024-11-20',
      'gpt-3.5-turbo': 'gpt-4o-mini',
      'claude-3': 'claude-3-5-sonnet-20241022',
      'gemini-pro': 'gemini-1.5-pro'
    }
  },
  budget: {
    name: '💰 Budget',
    description: 'Map to cheaper alternatives',
    mappings: {
      'gpt-4': 'deepseek-v3',
      'gpt-4o': 'deepseek-v3',
      'gpt-3.5-turbo': 'qwen-turbo',
      'claude-3': 'deepseek-chat',
      'claude-3.5-sonnet': 'deepseek-v3'
    }
  },
  fast: {
    name: '🚀 Fast',
    description: 'Map to fastest models',
    mappings: {
      'gpt-4': 'groq-llama-3.1-70b-versatile',
      'gpt-4o': 'groq-llama-3.1-70b-versatile',
      'gpt-3.5-turbo': 'groq-llama-3.1-8b-instant'
    }
  },
  vietnam: {
    name: '🇻🇳 Vietnam',
    description: 'Best for Vietnamese language',
    mappings: {
      'gpt-4': 'gpt-4o',
      'gpt-3.5-turbo': 'gpt-4o-mini',
      'claude-3': 'claude-3-5-sonnet-20241022'
    }
  }
};

// Parse JSON string to array of mappings
const parseJsonToMappings = (jsonString) => {
  if (!jsonString || jsonString === '' || jsonString === '{}') {
    return [];
  }
  try {
    const obj = JSON.parse(jsonString);
    return Object.entries(obj).map(([from, to]) => ({ from, to }));
  } catch (e) {
    return [];
  }
};

// Convert mappings array to JSON string
const mappingsToJson = (mappings) => {
  const validMappings = mappings.filter((m) => m.from && m.to);
  if (validMappings.length === 0) {
    return '';
  }
  const obj = {};
  validMappings.forEach((m) => {
    obj[m.from] = m.to;
  });
  return JSON.stringify(obj, null, 2);
};

const ModelMappingBuilder = ({ value, onChange, modelOptions }) => {
  const [mappings, setMappings] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize mappings from value
  useEffect(() => {
    const parsed = parseJsonToMappings(value);
    setMappings(parsed);
    // Show advanced if there are existing mappings
    if (parsed.length > 0) {
      setShowAdvanced(true);
    }
  }, [value]);

  // Update parent when mappings change
  const updateParent = useCallback(
    (newMappings) => {
      const json = mappingsToJson(newMappings);
      onChange(json);
    },
    [onChange]
  );

  const addMapping = () => {
    const newMappings = [...mappings, { from: '', to: '' }];
    setMappings(newMappings);
  };

  const removeMapping = (index) => {
    const newMappings = mappings.filter((_, i) => i !== index);
    setMappings(newMappings);
    updateParent(newMappings);
  };

  const updateMapping = (index, field, newValue) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: newValue };
    setMappings(newMappings);
    updateParent(newMappings);
  };

  const applyTemplate = (templateKey) => {
    const template = MAPPING_TEMPLATES[templateKey];
    if (template) {
      const newMappings = Object.entries(template.mappings).map(([from, to]) => ({
        from,
        to
      }));
      setMappings(newMappings);
      updateParent(newMappings);
    }
  };

  const clearAll = () => {
    setMappings([]);
    onChange('');
  };

  // Get model options as string array
  const modelList = modelOptions.map((m) => (typeof m === 'string' ? m : m.id));

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          🔗 Model Mapping
          <Chip size="small" label={mappings.length > 0 ? `${mappings.length} mapping(s)` : 'None'} variant="outlined" />
        </Typography>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        {/* Quick Templates */}
        <Box sx={{ mt: 1.5, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            ⚡ Quick Templates
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(MAPPING_TEMPLATES).map(([key, template]) => (
              <Chip
                key={key}
                label={template.name}
                onClick={() => applyTemplate(key)}
                variant="outlined"
                size="small"
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText'
                  }
                }}
              />
            ))}
            {mappings.length > 0 && (
              <Chip label="🗑️ Clear" onClick={clearAll} variant="outlined" size="small" color="error" sx={{ cursor: 'pointer' }} />
            )}
          </Stack>
        </Box>

        {/* Mapping Rows */}
        {mappings.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack spacing={1.5}>
              {mappings.map((mapping, index) => (
                <Stack key={index} direction="row" spacing={1} alignItems="center">
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={modelList}
                    value={mapping.from}
                    onChange={(_, v) => updateMapping(index, 'from', v || '')}
                    onInputChange={(_, v) => updateMapping(index, 'from', v || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Request Model" placeholder="e.g. gpt-4" variant="outlined" />
                    )}
                    sx={{ flex: 1, minWidth: 150 }}
                  />

                  <ArrowForwardIcon color="action" sx={{ mx: 0.5 }} />

                  <Autocomplete
                    freeSolo
                    size="small"
                    options={modelList}
                    value={mapping.to}
                    onChange={(_, v) => updateMapping(index, 'to', v || '')}
                    onInputChange={(_, v) => updateMapping(index, 'to', v || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Actual Model" placeholder="e.g. gpt-4o" variant="outlined" />
                    )}
                    sx={{ flex: 1, minWidth: 150 }}
                  />

                  <IconButton size="small" onClick={() => removeMapping(index)} color="error" sx={{ ml: 0.5 }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {/* Add Button */}
        <Button startIcon={<AddIcon />} onClick={addMapping} variant="outlined" size="small" sx={{ mt: 1 }}>
          Add Mapping
        </Button>

        {/* Advanced: Raw JSON Toggle */}
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            Advanced: Edit JSON directly
          </Typography>
          <Collapse in={showAdvanced}>
            <TextField
              multiline
              fullWidth
              size="small"
              minRows={3}
              maxRows={8}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder='{"gpt-4": "gpt-4o", "gpt-3.5-turbo": "gpt-4o-mini"}'
              sx={{ mt: 1, fontFamily: 'monospace' }}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
              }}
            />
          </Collapse>
        </Box>

        {/* Info */}
        <Alert severity="info" sx={{ mt: 2 }} icon={false}>
          <Typography variant="body2">
            💡 Model mapping redirects user requests to different actual models. Useful for version upgrades, cost optimization, or A/B
            testing.
          </Typography>
        </Alert>
      </Collapse>
    </Box>
  );
};

ModelMappingBuilder.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  modelOptions: PropTypes.array
};

ModelMappingBuilder.defaultProps = {
  value: '',
  modelOptions: []
};

export default ModelMappingBuilder;
