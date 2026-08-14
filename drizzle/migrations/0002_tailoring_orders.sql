CREATE TABLE IF NOT EXISTS `tailoringOrders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderNumber` varchar(60) NOT NULL,
  `customerId` int NOT NULL,
  `measurementProfileId` int,
  `assignedTailorId` int,
  `garmentType` varchar(80) NOT NULL DEFAULT 'Thoub',
  `quantity` int NOT NULL DEFAULT 1,
  `status` enum('draft','confirmed','cutting','stitching','fitting','ready','handed_over','cancelled') NOT NULL DEFAULT 'draft',
  `dueDate` date,
  `price` decimal(12,3) NOT NULL DEFAULT '0',
  `notes` text,
  `productionNotes` text,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `tailoringOrders_id` PRIMARY KEY(`id`),
  CONSTRAINT `tailoringOrders_orderNumber_unique` UNIQUE(`orderNumber`)
);
