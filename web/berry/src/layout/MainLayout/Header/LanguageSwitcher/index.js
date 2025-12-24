import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// material-ui
import { useTheme } from '@mui/material/styles';
import {
    Avatar,
    Box,
    ClickAwayListener,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Popper,
    Typography,
    Chip
} from '@mui/material';

// project imports
import Transitions from 'ui-component/extended/Transitions';

// assets
import { IconLanguage } from '@tabler/icons-react';

// ==============================|| LANGUAGE SWITCHER ||============================== //

const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh', label: '中文', flag: '🇨🇳' }
];

const LanguageSwitcher = () => {
    const theme = useTheme();
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);

    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

    const handleToggle = () => {
        setOpen((prevOpen) => !prevOpen);
    };

    const handleClose = (event) => {
        if (anchorRef.current && anchorRef.current.contains(event.target)) {
            return;
        }
        setOpen(false);
    };

    const handleLanguageChange = (langCode) => {
        i18n.changeLanguage(langCode);
        setOpen(false);
        // Save preference to localStorage
        localStorage.setItem('i18nextLng', langCode);
    };

    return (
        <>
            <Chip
                sx={{
                    height: '48px',
                    alignItems: 'center',
                    borderRadius: '27px',
                    transition: 'all .2s ease-in-out',
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark' ? theme.palette.dark.main : theme.palette.primary.light,
                    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.dark.main : theme.palette.primary.light,
                    '&[aria-controls="menu-list-grow"], &:hover': {
                        borderColor: theme.palette.primary.main,
                        background: `${theme.palette.primary.main}!important`,
                        color: theme.palette.primary.light,
                        '& svg': {
                            stroke: theme.palette.primary.light
                        }
                    },
                    '& .MuiChip-label': {
                        lineHeight: 0
                    }
                }}
                icon={
                    <Avatar
                        sx={{
                            ...theme.typography.mediumAvatar,
                            margin: '8px 0 8px 8px !important',
                            cursor: 'pointer',
                            bgcolor: theme.palette.mode === 'dark' ? theme.palette.dark.dark : theme.palette.primary[200]
                        }}
                        ref={anchorRef}
                        aria-controls={open ? 'menu-list-grow' : undefined}
                        aria-haspopup="true"
                        color="inherit"
                    >
                        <IconLanguage stroke={1.5} size="1.3rem" />
                    </Avatar>
                }
                label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body1">{currentLanguage.flag}</Typography>
                        <Typography variant="body2">{currentLanguage.label}</Typography>
                    </Box>
                }
                variant="outlined"
                ref={anchorRef}
                aria-controls={open ? 'menu-list-grow' : undefined}
                aria-haspopup="true"
                onClick={handleToggle}
                color="primary"
            />

            <Popper
                placement="bottom-end"
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                transition
                disablePortal
                popperOptions={{
                    modifiers: [
                        {
                            name: 'offset',
                            options: {
                                offset: [0, 14]
                            }
                        }
                    ]
                }}
            >
                {({ TransitionProps }) => (
                    <Transitions in={open} {...TransitionProps}>
                        <Paper>
                            <ClickAwayListener onClickAway={handleClose}>
                                <List
                                    component="nav"
                                    sx={{
                                        width: '100%',
                                        maxWidth: 200,
                                        minWidth: 150,
                                        backgroundColor: theme.palette.background.paper,
                                        borderRadius: '10px',
                                        [theme.breakpoints.down('md')]: {
                                            minWidth: '100%'
                                        },
                                        '& .MuiListItemButton-root': {
                                            mt: 0.5
                                        }
                                    }}
                                >
                                    {languages.map((lang) => (
                                        <ListItemButton
                                            key={lang.code}
                                            selected={i18n.language === lang.code}
                                            onClick={() => handleLanguageChange(lang.code)}
                                            sx={{
                                                borderRadius: '12px',
                                                mb: 0.5
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                <Typography variant="h4">{lang.flag}</Typography>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body1">
                                                            {lang.label}
                                                        </Typography>
                                                    }
                                                />
                                            </Box>
                                        </ListItemButton>
                                    ))}
                                </List>
                            </ClickAwayListener>
                        </Paper>
                    </Transitions>
                )}
            </Popper>
        </>
    );
};

export default LanguageSwitcher;
