import PropTypes from 'prop-types';
import { useState } from 'react';

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
  Button,
  Stack
} from '@mui/material';

import Label from 'ui-component/Label';
import TableSwitch from 'ui-component/Switch';
import { timestamp2string, renderQuota, copy } from 'utils/common';

import { IconDotsVertical, IconEdit, IconTrash } from '@tabler/icons-react';

export default function RedemptionTableRow({ item, manageRedemption, handleOpenModal, setModalRedemptionId }) {
  const [open, setOpen] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [statusSwitch, setStatusSwitch] = useState(item.status);

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

  const handleStatus = async () => {
    const switchVlue = statusSwitch === 1 ? 2 : 1;
    const { success } = await manageRedemption(item.id, 'status', switchVlue);
    if (success) {
      setStatusSwitch(switchVlue);
    }
  };

  const handleDelete = async () => {
    handleCloseMenu();
    await manageRedemption(item.id, 'delete', '');
  };

  return (
    <>
      <TableRow tabIndex={item.id}>
        <TableCell>{item.id}</TableCell>

        <TableCell>{item.name}</TableCell>

        <TableCell>
          {item.status !== 1 && item.status !== 2 ? (
            <Label variant="filled" color={item.status === 3 ? 'success' : 'orange'}>
              {item.status === 3 ? 'Used' : 'Unknown'}
            </Label>
          ) : (
            <TableSwitch id={`switch-${item.id}`} checked={statusSwitch === 1} onChange={handleStatus} />
          )}
        </TableCell>

        <TableCell>{renderQuota(item.quota)}</TableCell>
        <TableCell>{timestamp2string(item.created_time)}</TableCell>
        <TableCell>{item.redeemed_time ? timestamp2string(item.redeemed_time) : 'Not redeemed'}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                copy(item.key, 'Redemption code');
              }}
            >
              Copy
            </Button>
            <IconButton onClick={handleOpenMenu} sx={{ color: 'rgb(99, 115, 129)' }}>
              <IconDotsVertical />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>

      <Popover
        open={!!open}
        anchorEl={open}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { width: 140 }
        }}
      >
        <MenuItem
          disabled={item.status !== 1 && item.status !== 2}
          onClick={() => {
            handleCloseMenu();
            handleOpenModal();
            setModalRedemptionId(item.id);
          }}
        >
          <IconEdit style={{ marginRight: '16px' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteOpen} sx={{ color: 'error.main' }}>
          <IconTrash style={{ marginRight: '16px' }} />
          Delete
        </MenuItem>
      </Popover>

      <Dialog open={openDelete} onClose={handleDeleteClose}>
        <DialogTitle>DeleteRedemption code</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to deleteRedemption code {item.name}？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteClose}>Close</Button>
          <Button onClick={handleDelete} sx={{ color: 'error.main' }} autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

RedemptionTableRow.propTypes = {
  item: PropTypes.object,
  manageRedemption: PropTypes.func,
  handleOpenModal: PropTypes.func,
  setModalRedemptionId: PropTypes.func
};
