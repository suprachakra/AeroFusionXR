export class Order {
  constructor({ items, total }) {
    this.items = items;
    this.total = total;
    this.createdAt = new Date();
  }
}
