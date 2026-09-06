import { TableSkeleton } from "../TableSkeleton";

/**
 * Every render of this screen makes an outbound Razorpay call, so the wait is
 * a network round trip to a third party rather than a local query — the one
 * place a skeleton earns its keep most.
 *
 * Six columns: settled on, settlement, amount, fees, UTR, status.
 */
export default function Loading() {
  return <TableSkeleton title columns={6} />;
}
