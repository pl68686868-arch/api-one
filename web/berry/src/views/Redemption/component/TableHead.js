import { TableCell, TableHead, TableRow } from '@mui/material';
import { useTranslation } from 'react-i18next';

const RedemptionTableHead = () => {
  const { t } = useTranslation();
  return (
    <TableHead>
      <TableRow>
        <TableCell>{t('redemption.table.id')}</TableCell>
        <TableCell>{t('redemption.table.name')}</TableCell>
        <TableCell>{t('redemption.table.status')}</TableCell>
        <TableCell>{t('redemption.table.quota')}</TableCell>
        <TableCell>{t('redemption.table.created_time')}</TableCell>
        <TableCell>{t('redemption.table.redeemed_time')}</TableCell>
        <TableCell>{t('redemption.table.actions')}</TableCell>
      </TableRow>
    </TableHead>
  );
};

export default RedemptionTableHead;
