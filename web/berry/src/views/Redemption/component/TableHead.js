import { TableCell, TableHead, TableRow } from '@mui/material';

const RedemptionTableHead = () => {
  return (
    <TableHead>
      <TableRow>
        <TableCell>ID</TableCell>
        <TableCell>Name</TableCell>
        <TableCell>Status</TableCell>
        <TableCell>Quota</TableCell>
        <TableCell>Created Time</TableCell>
        <TableCell>RedeemTime</TableCell>
        <TableCell>Action</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default RedemptionTableHead;
