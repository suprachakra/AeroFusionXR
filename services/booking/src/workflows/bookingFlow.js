export default {
  execute: async (bookingRequest) => {
    // Call inventory, payment, loyalty microservices
    const payment = await paymentService.charge(bookingRequest);
    // ...additional business logic
    return { success: true, reference: payment.reference };
  }
};
