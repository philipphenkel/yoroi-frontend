// @flow
import type { Node } from 'react';
import { Box } from '@mui/system';
import { CircularProgress, Stack, Typography } from '@mui/material';

type Props = {|
  +percentage: number,
  +days: string,
  +currentEpoch: number,
  +startEpochDate: string,
  +endEpochDate: string,
|};

export function EpochProgressCard({
  percentage,
  days,
  currentEpoch,
  startEpochDate,
  endEpochDate,
}: Props): Node {
  return (
    <Box>
      <Stack direction="row" spacing={2} justifyContent="flex-start">
        <Graph value={percentage} days={days} />
        <Stack direction="column" flexGrow="1">
          <Title label="Current Epoch" value={currentEpoch} />
          <Stack direction="row" spacing={3} mt="50px" justifyContent="space-between">
            <LabelWithValue label="Epoch started at" value={startEpochDate} />
            <LabelWithValue label="Epoch ends at" value={endEpochDate} />
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

type TitleProps = {|
  +label: string,
  +value: string | number,
|};
const Title = ({ label, value }: TitleProps): Node => {
  return (
    <Box>
      <Typography fontWeight="500" color="var(--yoroi-palette-primary-300)">
        {label}: {value}
      </Typography>
    </Box>
  );
};

type InfoColumnProps = {|
  +label: string,
  +value: string | number,
|};
const LabelWithValue = ({ label, value }: InfoColumnProps): Node => {
  return (
    <Box>
      <Typography
        style={{ textTransform: 'uppercase' }}
        variant="caption"
        mb="4px"
        color="var(--yoroi-palette-gray-600)"
      >
        {label}
      </Typography>
      <Typography color="var(--yoroi-palette-gray-900)">{value}</Typography>
    </Box>
  );
};

const Graph = ({ value, days }): Node => {
  return (
    <Box mr="8px" position="relative" display="flex" justifyContent="center">
      <CircularProgress
        size={120}
        thickness={7}
        variant="determinate"
        value={value}
        sx={{
          color: 'var(--yoroi-palette-primary-300)',
          animationDuration: '550ms',
          position: 'absolute',
          zIndex: 1,
        }}
      />
      <CircularProgress
        size={120}
        thickness={7}
        variant="determinate"
        sx={{
          color: 'var(--yoroi-palette-gray-50)',
        }}
        value={100}
      />
      <Box
        position="absolute"
        sx={{
          top: '30%',
          left: '50%',
          transform: 'translate(-50%)',
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" color="var(--yoroi-palette-gray-900)">
          {value}%
        </Typography>
        <Typography variant="caption1" fontSize="12px" color="var(--yoroi-palette-gray-600)">
          {days} days
        </Typography>
      </Box>
    </Box>
  );
};
