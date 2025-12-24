import PropTypes from 'prop-types';
import { TableCell, TableHead, TableRow } from '@mui/material';

const LogTableHead = ({ userIsAdmin }) => {
  return (
    <TableHead>
      <TableRow>
        <TableCell width={50}></TableCell> {/* Expand button column */}
        <TableCell>Time</TableCell>
        {userIsAdmin && <TableCell>Channel</TableCell>}
        {userIsAdmin && <TableCell>User</TableCell>}
        <TableCell>Token</TableCell>
        <TableCell>Type</TableCell>
        <TableCell>Model</TableCell>
        <TableCell>Latency</TableCell>
        <TableCell>Mode</TableCell>
        <TableCell>Prompt</TableCell>
        <TableCell>Completion</TableCell>
        <TableCell>Quota</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default LogTableHead;

LogTableHead.propTypes = {
  userIsAdmin: PropTypes.bool
};
