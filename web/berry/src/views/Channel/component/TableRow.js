import PropTypes from "prop-types";
import { useState } from "react";

import { showInfo, showError, renderNumber } from "utils/common";
import { API } from "utils/api";
import { CHANNEL_OPTIONS } from "constants/ChannelConstants";

import {
  Popover,
  TableRow,
  MenuItem,
  TableCell,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
  Button,
  Box,
  Avatar,
  Stack,
  Typography,
} from "@mui/material";

import Label from "ui-component/Label";
import StatusLabel from "ui-component/StatusLabel";
import ResponseTimeBar from "ui-component/ResponseTimeBar";
import PriorityStars from "ui-component/PriorityStars";

import GroupLabel from "./GroupLabel";

import { IconDotsVertical, IconEdit, IconTrash, IconBrandOpenai } from "@tabler/icons-react";

// Provider icons mapping
const providerIcons = {
  1: { icon: '🤖', name: 'OpenAI' },
  3: { icon: '☁️', name: 'Azure' },
  14: { icon: '🧠', name: 'Anthropic' },
  24: { icon: '💎', name: 'Google' },
  36: { icon: '🌊', name: 'DeepSeek' },
  44: { icon: '⚡', name: 'SiliconFlow' },
};

export default function ChannelTableRow({
  item,
  manageChannel,
  handleOpenModal,
  setModalChannelId,
}) {
  const [open, setOpen] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [statusSwitch, setStatusSwitch] = useState(item.status);
  const [priorityValue, setPriority] = useState(item.priority);
  const [responseTimeData, setResponseTimeData] = useState({
    test_time: item.test_time,
    response_time: item.response_time,
  });
  const [itemBalance, setItemBalance] = useState(item.balance);

  const handleDeleteOpen = () => {
    handleCloseMenu();
    setOpenDelete(true);
  };

  const handleDeleteClose = () => {
    setOpenDelete(false);
  };

  const handleOpenMenu = (event) => {
    setOpen(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setOpen(null);
  };

  const handleStatusToggle = async () => {
    const switchValue = statusSwitch === 1 ? 2 : 1;
    const { success } = await manageChannel(item.id, "status", switchValue);
    if (success) {
      setStatusSwitch(switchValue);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    if (newPriority === priorityValue) return;
    await manageChannel(item.id, "priority", newPriority);
    setPriority(newPriority);
  };

  const handleResponseTime = async () => {
    const { success, time } = await manageChannel(item.id, "test", "");
    if (success) {
      setResponseTimeData({
        test_time: Date.now() / 1000,
        response_time: time * 1000,
      });
      showInfo(`Channel ${item.name} TestSuccess，耗时 ${time.toFixed(2)} 秒。`);
    }
  };

  const updateChannelBalance = async () => {
    const res = await API.get(`/api/channel/update_balance/${item.id}`);
    const { success, message, balance } = res.data;
    if (success) {
      setItemBalance(balance);
      showInfo(`BalanceUpdateSuccess！`);
    } else {
      showError(message);
    }
  };

  const handleDelete = async () => {
    handleCloseMenu();
    await manageChannel(item.id, "delete", "");
  };

  const providerInfo = providerIcons[item.type] || { icon: '🔌', name: 'Custom' };

  return (
    <>
      <TableRow
        tabIndex={item.id}
        sx={{
          '&:hover': {
            bgcolor: 'action.hover',
          },
          transition: 'background-color 0.2s ease'
        }}
      >
        {/* ID with gradient accent */}
        <TableCell>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: 'primary.lighter',
              color: 'primary.main',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            {item.id}
          </Box>
        </TableCell>

        {/* Name with provider icon */}
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Tooltip title={providerInfo.name}>
              <Box
                sx={{
                  fontSize: '1.25rem',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                  bgcolor: 'background.neutral'
                }}
              >
                {providerInfo.icon}
              </Box>
            </Tooltip>
            <Box>
              <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {item.models?.split(',').slice(0, 2).join(', ')}
                {item.models?.split(',').length > 2 && ` +${item.models.split(',').length - 2}`}
              </Typography>
            </Box>
          </Stack>
        </TableCell>

        {/* Group */}
        <TableCell>
          <GroupLabel group={item.group} />
        </TableCell>

        {/* Type */}
        <TableCell>
          {!CHANNEL_OPTIONS[item.type] ? (
            <Label color="error" variant="soft">
              Unknown
            </Label>
          ) : (
            <Label color={CHANNEL_OPTIONS[item.type].color} variant="soft">
              {CHANNEL_OPTIONS[item.type].text}
            </Label>
          )}
        </TableCell>

        {/* Status - New StatusLabel component */}
        <TableCell>
          <StatusLabel
            status={statusSwitch}
            onClick={handleStatusToggle}
          />
        </TableCell>

        {/* Response Time - New visual bar */}
        <TableCell>
          <ResponseTimeBar
            responseTime={responseTimeData.response_time}
            testTime={responseTimeData.test_time}
            onClick={handleResponseTime}
          />
        </TableCell>

        {/* Used Quota */}
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {renderNumber(item.used_quota)}
          </Typography>
        </TableCell>

        {/* Balance */}
        <TableCell>
          <Tooltip title="点击UpdateBalance" placement="top">
            <Box
              onClick={updateChannelBalance}
              sx={{
                cursor: 'pointer',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                display: 'inline-block',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
            >
              {renderBalance(item.type, itemBalance)}
            </Box>
          </Tooltip>
        </TableCell>

        {/* Priority - New Stars component */}
        <TableCell>
          <PriorityStars
            priority={priorityValue}
            onChange={handlePriorityChange}
          />
        </TableCell>

        {/* Actions */}
        <TableCell>
          <IconButton
            onClick={handleOpenMenu}
            sx={{
              color: "rgb(99, 115, 129)",
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
          >
            <IconDotsVertical size={20} />
          </IconButton>
        </TableCell>
      </TableRow>

      {/* Action Menu */}
      <Popover
        open={!!open}
        anchorEl={open}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: 140,
            boxShadow: (theme) => theme.shadows[8],
            borderRadius: 1.5
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            handleOpenModal();
            setModalChannelId(item.id);
          }}
          sx={{ py: 1.5 }}
        >
          <IconEdit size={18} style={{ marginRight: 12 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={handleDeleteOpen}
          sx={{ color: "error.main", py: 1.5 }}
        >
          <IconTrash size={18} style={{ marginRight: 12 }} />
          Delete
        </MenuItem>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDelete}
        onClose={handleDeleteClose}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>DeleteChannel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要DeleteChannel <strong>{item.name}</strong> 吗？此Action无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleDeleteClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            autoFocus
          >
            ConfirmDelete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

ChannelTableRow.propTypes = {
  item: PropTypes.object,
  manageChannel: PropTypes.func,
  handleOpenModal: PropTypes.func,
  setModalChannelId: PropTypes.func,
};

function renderBalance(type, balance) {
  const balanceStyles = {
    fontWeight: 600,
    fontSize: '0.875rem'
  };

  switch (type) {
    case 1: // OpenAI
      return <Typography sx={{ ...balanceStyles, color: 'success.main' }}>${balance.toFixed(2)}</Typography>;
    case 4: // CloseAI
      return <Typography sx={{ ...balanceStyles, color: 'warning.main' }}>¥{balance.toFixed(2)}</Typography>;
    case 8: // 自定义
      return <Typography sx={{ ...balanceStyles, color: 'success.main' }}>${balance.toFixed(2)}</Typography>;
    case 5: // OpenAI-SB
      return <Typography sx={{ ...balanceStyles, color: 'warning.main' }}>¥{(balance / 10000).toFixed(2)}</Typography>;
    case 10: // AI Proxy
      return <Typography sx={balanceStyles}>{renderNumber(balance)}</Typography>;
    case 12: // API2GPT
      return <Typography sx={{ ...balanceStyles, color: 'warning.main' }}>¥{balance.toFixed(2)}</Typography>;
    case 13: // AIGC2D
      return <Typography sx={balanceStyles}>{renderNumber(balance)}</Typography>;
    case 36: // DeepSeek
      return <Typography sx={{ ...balanceStyles, color: 'info.main' }}>¥{balance.toFixed(2)}</Typography>;
    case 44: // SiliconFlow
      return <Typography sx={{ ...balanceStyles, color: 'info.main' }}>¥{balance.toFixed(2)}</Typography>;
    default:
      return <Typography sx={{ ...balanceStyles, color: 'text.secondary' }}>--</Typography>;
  }
}
