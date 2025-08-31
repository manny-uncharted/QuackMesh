// Minimal ABI for ComputeMarketplace with training job extension
export const ComputeMarketplaceABI = [
  {
    type: 'event',
    name: 'MachineListed',
    inputs: [
      { name: 'machineId', type: 'uint256', indexed: true },
      { name: 'provider', type: 'address', indexed: true },
      { name: 'specs', type: 'string', indexed: false },
      { name: 'pricePerHourInDuck', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MachineUnlisted',
    inputs: [{ name: 'machineId', type: 'uint256', indexed: true }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MachineRented',
    inputs: [
      { name: 'machineId', type: 'uint256', indexed: true },
      { name: 'renter', type: 'address', indexed: true },
      { name: 'hoursPaid', type: 'uint256', indexed: false },
      { name: 'totalPaidDuck', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TrainingJobCreated',
    inputs: [
      { name: 'machineId', type: 'uint256', indexed: true },
      { name: 'renter', type: 'address', indexed: true },
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'modelId', type: 'string', indexed: false },
      { name: 'datasetId', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'rentMachine',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'machineId', type: 'uint256' },
      { name: 'hoursPaid', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rentMachineWithJob',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'machineId', type: 'uint256' },
      { name: 'hoursPaid', type: 'uint256' },
      { name: 'modelId', type: 'string' },
      { name: 'datasetId', type: 'string' },
    ],
    outputs: [
      { name: 'jobId', type: 'uint256' },
    ],
  },
] as const
