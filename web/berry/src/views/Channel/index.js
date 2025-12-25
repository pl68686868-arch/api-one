import { useState, useEffect } from 'react';
import { showError, showSuccess, showInfo, loadChannelModels } from 'utils/common';

import { useTheme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import PerfectScrollbar from 'react-perfect-scrollbar';
import TablePagination from '@mui/material/TablePagination';
import LinearProgress from '@mui/material/LinearProgress';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  Button,
  IconButton,
  Card,
  Box,
  Stack,
  Container,
  Typography,
  Divider,
  Tooltip,
  Chip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';
import ChannelTableRow from './component/TableRow';
import ChannelTableHead from './component/TableHead';
import ChannelTableSkeleton from './component/ChannelTableSkeleton';
import ChannelHealthOverview from './component/ChannelHealthOverview';
import TableToolBar from 'ui-component/TableToolBar';
import { API } from 'utils/api';
import { ITEMS_PER_PAGE } from 'constants';
import {
  IconRefresh,
  IconTrash,
  IconPlus,
  IconTestPipe,
  IconCoin
} from '@tabler/icons-react';
import EditeModal from './component/EditModal';

// ----------------------------------------------------------------------

export default function ChannelPage() {
  const [channels, setChannels] = useState([]);
  const [activePage, setActivePage] = useState(0);
  const [searching, setSearching] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [testProgress, setTestProgress] = useState({ running: false, current: 0, total: 0 });
  const theme = useTheme();
  const matchUpMd = useMediaQuery(theme.breakpoints.up('sm'));
  const [openModal, setOpenModal] = useState(false);
  const [editChannelId, setEditChannelId] = useState(0);

  const loadChannels = async (startIdx) => {
    setSearching(true);
    const res = await API.get(`/api/channel/?p=${startIdx}`);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setChannels(data);
      } else {
        let newChannels = [...channels];
        newChannels.splice(startIdx * ITEMS_PER_PAGE, data.length, ...data);
        setChannels(newChannels);
      }
    } else {
      showError(message);
    }
    setSearching(false);
    setInitialLoading(false);
  };

  const onPaginationChange = (event, activePage) => {
    (async () => {
      if (activePage === Math.ceil(channels.length / ITEMS_PER_PAGE)) {
        await loadChannels(activePage);
      }
      setActivePage(activePage);
    })();
  };

  const searchChannels = async (event) => {
    event.preventDefault();
    if (searchKeyword === '') {
      await loadChannels(0);
      setActivePage(0);
      return;
    }
    setSearching(true);
    const res = await API.get(`/api/channel/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      setChannels(data);
      setActivePage(0);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleSearchKeyword = (event) => {
    setSearchKeyword(event.target.value);
  };

  const manageChannel = async (id, action, value) => {
    const url = '/api/channel/';
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(url + id);
        break;
      case 'status':
        res = await API.put(url, {
          ...data,
          status: value
        });
        break;
      case 'priority':
        if (value === '') {
          return;
        }
        res = await API.put(url, {
          ...data,
          priority: parseInt(value)
        });
        break;
      case 'test':
        res = await API.get(url + `test/${id}`);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess('ActionSuccess完成！');
      if (action === 'delete') {
        await handleRefresh();
      }
    } else {
      showError(message);
    }

    return res.data;
  };

  const handleRefresh = async () => {
    await loadChannels(activePage);
  };

  const testAllChannels = async () => {
    setTestProgress({ running: true, current: 0, total: channels.filter(c => c.status === 1).length });
    const res = await API.get(`/api/channel/test`);
    const { success, message } = res.data;
    if (success) {
      showInfo('已Success开始Test所有Channel，请稍后Refresh页面查看结果。');
    } else {
      showError(message);
    }
    // Simulate progress (since backend doesn't provide real-time progress)
    setTimeout(() => {
      setTestProgress({ running: false, current: 0, total: 0 });
    }, 3000);
  };

  const deleteAllDisabledChannels = async () => {
    const disabledCount = channels.filter(c => c.status !== 1).length;
    if (disabledCount === 0) {
      showInfo('没有Disable的Channel可Delete');
      return;
    }
    if (!window.confirm(`确定要Delete ${disabledCount} 个Disable的Channel吗？`)) {
      return;
    }
    const res = await API.delete(`/api/channel/disabled`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(`已Delete所有DisableChannel，共计 ${data} 个`);
      await handleRefresh();
    } else {
      showError(message);
    }
  };

  const updateAllChannelsBalance = async () => {
    setSearching(true);
    const res = await API.get(`/api/channel/update_balance`);
    const { success, message } = res.data;
    if (success) {
      showInfo('已Update完毕所有EnabledChannelBalance！');
      await handleRefresh();
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleOpenModal = (channelId) => {
    setEditChannelId(channelId);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditChannelId(0);
  };

  const handleOkModal = (status) => {
    if (status === true) {
      handleCloseModal();
      handleRefresh();
    }
  };

  useEffect(() => {
    loadChannels(0)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    loadChannelModels().then();
  }, []);

  const activeCount = channels.filter(c => c.status === 1).length;
  const disabledCount = channels.filter(c => c.status !== 1).length;

  return (
    <>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Channel Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your AI service channels
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<IconPlus size={18} />}
          onClick={() => handleOpenModal(0)}
          sx={{
            px: 2.5,
            py: 1,
            borderRadius: 2,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4
            }
          }}
        >
          New Channel
        </Button>
      </Stack>

      {/* Health Overview */}
      <ChannelHealthOverview channels={channels} isLoading={initialLoading} />

      {/* Main Card */}
      <Card className="glass-card shadow-premium-hover" sx={{ borderRadius: 2, boxShadow: 2 }}>
        {/* Search Bar */}
        <Box component="form" onSubmit={searchChannels} noValidate sx={{ px: 2, pt: 2 }}>
          <TableToolBar
            filterName={searchKeyword}
            handleFilterName={handleSearchKeyword}
            placeholder={'Search channel ID, name or key...'}
          />
        </Box>

        {/* Action Toolbar */}
        <Toolbar
          sx={{
            height: 56,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`${activeCount} 活跃`}
              color="success"
              size="small"
              variant="outlined"
            />
            {disabledCount > 0 && (
              <Chip
                label={`${disabledCount} Disable`}
                color="warning"
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          {matchUpMd ? (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh列表">
                <IconButton onClick={handleRefresh} size="small" sx={{ bgcolor: 'action.hover' }}>
                  <IconRefresh size={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Test所有EnableChannel">
                <IconButton
                  onClick={testAllChannels}
                  size="small"
                  sx={{ bgcolor: 'action.hover' }}
                  disabled={testProgress.running}
                >
                  <IconTestPipe size={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Update所有Balance">
                <IconButton onClick={updateAllChannelsBalance} size="small" sx={{ bgcolor: 'action.hover' }}>
                  <IconCoin size={18} />
                </IconButton>
              </Tooltip>
              {disabledCount > 0 && (
                <Tooltip title={`Delete ${disabledCount} 个DisableChannel`}>
                  <IconButton
                    onClick={deleteAllDisabledChannels}
                    size="small"
                    sx={{ bgcolor: 'error.lighter', color: 'error.main' }}
                  >
                    <IconTrash size={18} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ) : (
            <SpeedDial
              ariaLabel="Channel actions"
              sx={{ position: 'relative' }}
              icon={<SpeedDialIcon />}
              direction="left"
              FabProps={{ size: 'small' }}
            >
              <SpeedDialAction icon={<IconRefresh size={18} />} tooltipTitle="Refresh" onClick={handleRefresh} />
              <SpeedDialAction icon={<IconTestPipe size={18} />} tooltipTitle="Test" onClick={testAllChannels} />
              <SpeedDialAction icon={<IconCoin size={18} />} tooltipTitle="UpdateBalance" onClick={updateAllChannelsBalance} />
            </SpeedDial>
          )}
        </Toolbar>

        {/* Progress Indicators */}
        {(searching || testProgress.running) && (
          <LinearProgress
            color={testProgress.running ? 'info' : 'primary'}
            variant={testProgress.running ? 'indeterminate' : 'indeterminate'}
          />
        )}

        {/* Table */}
        <PerfectScrollbar component="div">
          <TableContainer sx={{ overflow: 'unset' }}>
            <Table sx={{ minWidth: 900 }}>
              <ChannelTableHead />
              <TableBody>
                {initialLoading ? (
                  <ChannelTableSkeleton rows={5} />
                ) : (
                  channels.slice(activePage * ITEMS_PER_PAGE, (activePage + 1) * ITEMS_PER_PAGE).map((row) => (
                    <ChannelTableRow
                      item={row}
                      manageChannel={manageChannel}
                      key={row.id}
                      handleOpenModal={handleOpenModal}
                      setModalChannelId={setEditChannelId}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </PerfectScrollbar>

        {/* Pagination */}
        <TablePagination
          page={activePage}
          component="div"
          count={channels.length + (channels.length % ITEMS_PER_PAGE === 0 ? 1 : 0)}
          rowsPerPage={ITEMS_PER_PAGE}
          onPageChange={onPaginationChange}
          rowsPerPageOptions={[ITEMS_PER_PAGE]}
          sx={{
            borderTop: 1,
            borderColor: 'divider'
          }}
        />
      </Card>

      {/* Edit Modal */}
      <EditeModal open={openModal} onCancel={handleCloseModal} onOk={handleOkModal} channelId={editChannelId} />
    </>
  );
}
