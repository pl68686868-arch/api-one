import { TableCell, TableHead, TableRow } from '@mui/material';

const ChannelTableHead = () => {
  return (
    <TableHead>
      <TableRow>
        <TableCell>ID</TableCell>
        <TableCell>Name</TableCell>
        <TableCell>Group</TableCell>
        <TableCell>Type</TableCell>
        <TableCell>Status</TableCell>
        <TableCell>ResponseTime</TableCell>
        <TableCell>Consumed耗</TableCell>
        <TableCell>Balance</TableCell>
        <TableCell>Priority level</TableCell>
        <TableCell>Action</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default ChannelTableHead;
