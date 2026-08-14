CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffProfileId` int NOT NULL,
	`workDate` date NOT NULL,
	`status` enum('present','absent','leave','half_day') NOT NULL,
	`notes` text,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`detailsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(320),
	`permissionsJson` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customRoles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`email` varchar(320),
	`address` text,
	`notes` text,
	`preferredContact` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(60) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('fabric','lining','buttons','thread','accessory','other') NOT NULL,
	`color` varchar(60),
	`widthInches` decimal(10,2),
	`unit` varchar(40) NOT NULL DEFAULT 'Meters',
	`quantity` decimal(12,3) NOT NULL DEFAULT '0',
	`minThreshold` decimal(12,3) NOT NULL DEFAULT '0',
	`costPerUnit` decimal(12,3) NOT NULL DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryItems_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`invoiceNumber` varchar(60) NOT NULL,
	`status` enum('paid','partial','unpaid','void') NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`dueDate` date,
	`notes` text,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_saleId_unique` UNIQUE(`saleId`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `measurementProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`version` int NOT NULL,
	`measurementsJson` json NOT NULL,
	`fitPreference` varchar(100),
	`collarStyle` varchar(100),
	`pocketStyle` varchar(100),
	`notes` text,
	`effectiveDate` date NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurementProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pendingAccessRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	`note` varchar(500),
	CONSTRAINT `pendingAccessRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `pendingAccessRequests_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `performanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffProfileId` int NOT NULL,
	`workDate` date NOT NULL,
	`metric` varchar(120) NOT NULL,
	`units` decimal(12,3) NOT NULL,
	`commissionEarned` decimal(12,3) NOT NULL DEFAULT '0',
	`notes` text,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `performanceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salaryPayouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffProfileId` int NOT NULL,
	`payPeriod` varchar(20) NOT NULL,
	`baseSalary` decimal(12,3) NOT NULL,
	`performanceBonus` decimal(12,3) NOT NULL DEFAULT '0',
	`deductions` decimal(12,3) NOT NULL DEFAULT '0',
	`netSalary` decimal(12,3) NOT NULL,
	`notes` text,
	`approvedBy` int NOT NULL,
	`paidAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salaryPayouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`serviceId` int,
	`inventoryItemId` int,
	`nameSnapshot` varchar(160) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unitPrice` decimal(12,3) NOT NULL,
	`total` decimal(12,3) NOT NULL,
	`assignedTailorId` int,
	`measurementProfileId` int,
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleNumber` varchar(60) NOT NULL,
	`customerId` int,
	`customerNameSnapshot` varchar(160) NOT NULL,
	`customerPhoneSnapshot` varchar(50),
	`subtotal` decimal(12,3) NOT NULL,
	`discount` decimal(12,3) NOT NULL DEFAULT '0',
	`total` decimal(12,3) NOT NULL,
	`paymentMethod` enum('cash','benefitpay','bank_transfer','credit_card') NOT NULL,
	`paymentStatus` enum('paid','partial','unpaid') NOT NULL DEFAULT 'paid',
	`source` enum('counter','manual','tailoring') NOT NULL DEFAULT 'counter',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_saleNumber_unique` UNIQUE(`saleNumber`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(60) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('tailoring','fabric','alteration','accessory','other') NOT NULL,
	`description` text,
	`unitPrice` decimal(12,3) NOT NULL,
	`inventoryItemId` int,
	`defaultFabricMeters` decimal(12,3),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `shopSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopName` varchar(160) NOT NULL,
	`arabicShopName` varchar(160),
	`crNumber` varchar(80),
	`currency` varchar(8) NOT NULL DEFAULT 'BHD',
	`phone` varchar(50),
	`email` varchar(320),
	`address` text,
	`invoicePrefix` varchar(16) NOT NULL DEFAULT 'INV',
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shopSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffAccessInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`customRoleId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`invitedBy` int NOT NULL,
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedByUserId` int,
	`acceptedAt` timestamp,
	CONSTRAINT `staffAccessInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffAccessInvites_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `staffProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(160) NOT NULL,
	`phone` varchar(50),
	`jobTitle` varchar(100) NOT NULL,
	`baseSalary` decimal(12,3) NOT NULL,
	`commissionRate` decimal(8,3) NOT NULL DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryItemId` int NOT NULL,
	`movementType` enum('opening','adjustment','sale','return','purchase') NOT NULL,
	`quantityChange` decimal(12,3) NOT NULL,
	`quantityBefore` decimal(12,3) NOT NULL,
	`quantityAfter` decimal(12,3) NOT NULL,
	`referenceType` varchar(40),
	`referenceId` int,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tailoringOrders` (
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
--> statement-breakpoint
CREATE TABLE `userBusinessRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','sales','tailor','inventory','payroll') NOT NULL DEFAULT 'sales',
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userBusinessRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userBusinessRoles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `userCustomRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customRoleId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userCustomRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userCustomRoles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(320) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`passwordHash` varchar(255),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
