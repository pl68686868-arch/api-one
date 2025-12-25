import { TableCell, TableHead, TableRow } from '@mui/material';

const UsersTableHead = () => {
  return (
    <TableHead>
      <TableRow>
        <TableCell>ID</TableCell>
        <TableCell>User名</TableCell>
        <TableCell>Group</TableCell>
        <TableCell>Statistics信息</TableCell>
        <TableCell>User角色</TableCell>
        <TableCell>绑定</TableCell>
        <TableCell>Status</TableCell>
        <TableCell>Action</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default UsersTableHead;
