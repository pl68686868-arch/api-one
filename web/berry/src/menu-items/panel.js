// assets
import {
  IconDashboard,
  IconSitemap,
  IconArticle,
  IconCoin,
  IconAdjustments,
  IconKey,
  IconGardenCart,
  IconUser,
  IconUserScan
} from '@tabler/icons-react';

// constant
const icons = { IconDashboard, IconSitemap, IconArticle, IconCoin, IconAdjustments, IconKey, IconGardenCart, IconUser, IconUserScan };

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const panel = {
  id: 'panel',
  type: 'group',
  children: [
    {
      id: 'dashboard',
      title: 'header.dashboard',
      type: 'item',
      url: '/panel/dashboard',
      icon: icons.IconDashboard,
      breadcrumbs: false,
      isAdmin: false
    },
    {
      id: 'channel',
      title: 'header.channel',
      type: 'item',
      url: '/panel/channel',
      icon: icons.IconSitemap,
      breadcrumbs: false,
      isAdmin: true
    },
    {
      id: 'token',
      title: 'header.token',
      type: 'item',
      url: '/panel/token',
      icon: icons.IconKey,
      breadcrumbs: false
    },
    {
      id: 'log',
      title: 'header.log',
      type: 'item',
      url: '/panel/log',
      icon: icons.IconArticle,
      breadcrumbs: false
    },
    {
      id: 'redemption',
      title: 'header.redemption',
      type: 'item',
      url: '/panel/redemption',
      icon: icons.IconCoin,
      breadcrumbs: false,
      isAdmin: true
    },
    {
      id: 'topup',
      title: 'header.topup',
      type: 'item',
      url: '/panel/topup',
      icon: icons.IconGardenCart,
      breadcrumbs: false
    },
    {
      id: 'user',
      title: 'header.user',
      type: 'item',
      url: '/panel/user',
      icon: icons.IconUser,
      breadcrumbs: false,
      isAdmin: true
    },
    {
      id: 'profile',
      title: 'header.profile',
      type: 'item',
      url: '/panel/profile',
      icon: icons.IconUserScan,
      breadcrumbs: false,
      isAdmin: false
    },
    {
      id: 'setting',
      title: 'header.setting',
      type: 'item',
      url: '/panel/setting',
      icon: icons.IconAdjustments,
      breadcrumbs: false,
      isAdmin: true
    }
  ]
};

export default panel;
