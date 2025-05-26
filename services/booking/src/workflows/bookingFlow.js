import reserveInventory from './paymentStep.js';
import chargePayment from './loyaltyStep.js';

export async function runBookingFlow(data) {
  const reservation = await reserveInventory(data);
  const payment = await chargePayment(reservation);
  return { reservation, payment };
