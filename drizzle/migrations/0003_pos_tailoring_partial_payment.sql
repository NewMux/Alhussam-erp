ALTER TABLE `sales`
  MODIFY COLUMN `paymentStatus` ENUM('paid', 'partial', 'unpaid') NOT NULL DEFAULT 'paid';

ALTER TABLE `invoices`
  MODIFY COLUMN `status` ENUM('paid', 'partial', 'unpaid', 'void') NOT NULL;
