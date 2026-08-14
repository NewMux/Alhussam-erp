ALTER TABLE `sales`
  ADD COLUMN `source` ENUM('counter', 'manual', 'tailoring') NOT NULL DEFAULT 'counter' AFTER `paymentStatus`;

UPDATE `sales`
SET `source` = 'tailoring'
WHERE `saleNumber` LIKE 'POS-TO-%';
