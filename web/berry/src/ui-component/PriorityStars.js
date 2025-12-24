import PropTypes from 'prop-types';
import { Box, Tooltip } from '@mui/material';
import { IconStar, IconStarFilled } from '@tabler/icons-react';

const PriorityStars = ({ priority, onChange, max = 5, readOnly = false }) => {
    // Map priority 0-100 to stars 0-5
    const starValue = Math.round((Math.min(priority, 100) / 100) * max);

    const handleClick = (newValue) => {
        if (readOnly || !onChange) return;
        // Convert stars back to priority (0-100)
        const newPriority = Math.round((newValue / max) * 100);
        onChange(newPriority);
    };

    return (
        <Tooltip
            title={readOnly ? `优先级: ${priority}` : `点击设置优先级 (当前: ${priority})`}
            arrow
        >
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.25,
                    cursor: readOnly ? 'default' : 'pointer'
                }}
            >
                {[...Array(max)].map((_, index) => {
                    const isFilled = index < starValue;
                    return (
                        <Box
                            key={index}
                            onClick={() => handleClick(index + 1)}
                            sx={{
                                color: isFilled ? 'warning.main' : 'action.disabled',
                                transition: 'all 0.15s ease',
                                '&:hover': !readOnly ? {
                                    transform: 'scale(1.2)',
                                    color: 'warning.main'
                                } : {}
                            }}
                        >
                            {isFilled ? (
                                <IconStarFilled size={16} />
                            ) : (
                                <IconStar size={16} />
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Tooltip>
    );
};

PriorityStars.propTypes = {
    priority: PropTypes.number.isRequired,
    onChange: PropTypes.func,
    max: PropTypes.number,
    readOnly: PropTypes.bool
};

export default PriorityStars;
