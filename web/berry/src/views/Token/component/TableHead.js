import { TableCell, TableHead, TableRow } from '@mui/material';

const TokenTableHead = () => {
  return (
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
        <TableCell>Status</TableCell>
        <TableCell>Used Quota</TableCell>
        <TableCell>Remaining Quota</TableCell>
        <TableCell>Created Time</TableCell>
        <TableCell>ExpiredTime</TableCell>
        <TableCell>Action</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default TokenTableHead;
