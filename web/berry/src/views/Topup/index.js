import { Stack, Alert } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import TopupCard from './component/TopupCard';
import InviteCard from './component/InviteCard';

const Topup = () => {
  return (
    <Grid container spacing={2}>
      <Grid xs={12}>
        <Alert severity="warning">
          Topup记录以及Invite记录请在Logs中查询。Topup记录请在Logs中选择Type【Topup】查询；Invite记录请在Logs中选择【System】查询{' '}
        </Alert>
      </Grid>
      <Grid xs={12} md={6} lg={8}>
        <Stack spacing={2}>
          <TopupCard />
        </Stack>
      </Grid>
      <Grid xs={12} md={6} lg={4}>
        <InviteCard />
      </Grid>
    </Grid>
  );
};

export default Topup;
