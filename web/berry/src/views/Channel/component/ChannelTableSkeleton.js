import { Box, Skeleton, TableCell, TableRow } from '@mui/material';

const ChannelTableSkeleton = ({ rows = 5 }) => {
    return (
        <>
            {[...Array(rows)].map((_, index) => (
                <TableRow key={index}>
                    {/* ID */}
                    <TableCell>
                        <Skeleton variant="rounded" width={32} height={32} />
                    </TableCell>

                    {/* Name */}
                    <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Skeleton variant="rounded" width={32} height={32} />
                            <Box>
                                <Skeleton width={120} height={20} />
                                <Skeleton width={80} height={14} />
                            </Box>
                        </Box>
                    </TableCell>

                    {/* Group */}
                    <TableCell>
                        <Skeleton variant="rounded" width={60} height={24} />
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                        <Skeleton variant="rounded" width={80} height={24} />
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                        <Skeleton variant="rounded" width={90} height={28} />
                    </TableCell>

                    {/* Response Time */}
                    <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Skeleton variant="rounded" width={60} height={6} />
                            <Skeleton width={45} height={16} />
                        </Box>
                    </TableCell>

                    {/* Used Quota */}
                    <TableCell>
                        <Skeleton width={50} height={20} />
                    </TableCell>

                    {/* Balance */}
                    <TableCell>
                        <Skeleton width={60} height={20} />
                    </TableCell>

                    {/* Priority */}
                    <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} variant="circular" width={16} height={16} />
                            ))}
                        </Box>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                        <Skeleton variant="circular" width={32} height={32} />
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
};

export default ChannelTableSkeleton;
