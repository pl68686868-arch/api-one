import PropTypes from 'prop-types';
import { useState } from 'react';

import { TableRow, TableCell, Collapse, Box, IconButton, Chip, Tooltip } from '@mui/material';

import { timestamp2string, renderQuota } from 'utils/common';
import Label from 'ui-component/Label';
import LogType from '../type/LogType';
import LogDetailPanel from './LogDetailPanel';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

function renderType(type) {
  const typeOption = LogType[type];
  if (typeOption) {
    return (
      <Label variant="filled" color={typeOption.color}>
        {' '}
        {typeOption.text}{' '}
      </Label>
    );
  } else {
    return (
      <Label variant="filled" color="error">
        {' '}
        未知{' '}
      </Label>
    );
  }
}

// Latency badge with color coding
function renderLatency(elapsedTime) {
  if (!elapsedTime || elapsedTime === 0) return null;

  let color = 'success';
  if (elapsedTime > 1000) color = 'warning';
  if (elapsedTime > 3000) color = 'error';

  return (
    <Chip
      label={`${elapsedTime} ms`}
      color={color}
      size="small"
      sx={{ fontWeight: 600, minWidth: 70 }}
    />
  );
}

export default function LogTableRow({ item, userIsAdmin }) {
  const [open, setOpen] = useState(false);
  const hasDetails = item.selection_reason || item.request_id || item.content;

  return (
    <>
      <TableRow tabIndex={item.id} hover>
        {/* Expand Button */}
        <TableCell sx={{ width: 50 }}>
          {hasDetails && (
            <IconButton
              size="small"
              onClick={() => setOpen(!open)}
              sx={{
                transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              {open ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
            </IconButton>
          )}
        </TableCell>

        {/* Timestamp */}
        <TableCell>{timestamp2string(item.created_at)}</TableCell>

        {/* Channel */}
        {userIsAdmin && <TableCell>{item.channel || ''}</TableCell>}

        {/* User */}
        {userIsAdmin && (
          <TableCell>
            <Label color="default" variant="outlined">
              {item.username}
            </Label>
          </TableCell>
        )}

        {/* Token */}
        <TableCell>
          {item.token_name && (
            <Label color="default" variant="soft">
              {item.token_name}
            </Label>
          )}
        </TableCell>

        {/* Type */}
        <TableCell>{renderType(item.type)}</TableCell>

        {/* Model / Virtual Model */}
        <TableCell>
          {item.virtual_model ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Chip
                label={item.virtual_model}
                color="secondary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
              {item.resolved_model && (
                <Tooltip title="Resolved to">
                  <Chip
                    label={item.resolved_model}
                    color="primary"
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              )}
            </Box>
          ) : (
            item.model_name && (
              <Label color="primary" variant="outlined">
                {item.model_name}
              </Label>
            )
          )}
        </TableCell>

        {/* Latency */}
        <TableCell>{renderLatency(item.elapsed_time)}</TableCell>

        {/* Stream Mode */}
        <TableCell sx={{ textAlign: 'center' }}>
          {item.is_stream && (
            <Chip
              label="Stream"
              color="info"
              size="small"
              variant="outlined"
            />
          )}
        </TableCell>

        {/* Prompt Tokens */}
        <TableCell>{item.prompt_tokens || ''}</TableCell>

        {/* Completion Tokens */}
        <TableCell>{item.completion_tokens || ''}</TableCell>

        {/* Quota */}
        <TableCell>{item.quota ? renderQuota(item.quota, 6) : ''}</TableCell>
      </TableRow>

      {/* Expandable Detail Row */}
      {hasDetails && (
        <TableRow>
          <TableCell colSpan={13} sx={{ py: 0, bgcolor: 'background.default' }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ py: 3, px: 2 }}>
                <LogDetailPanel item={item} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

LogTableRow.propTypes = {
  item: PropTypes.object,
  userIsAdmin: PropTypes.bool
};
