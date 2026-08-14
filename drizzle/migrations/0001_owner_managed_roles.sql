CREATE TABLE IF NOT EXISTS `customRoles` (
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

CREATE TABLE IF NOT EXISTS `userCustomRoles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `customRoleId` int NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `updatedBy` int NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `userCustomRoles_id` PRIMARY KEY(`id`),
  CONSTRAINT `userCustomRoles_userId_unique` UNIQUE(`userId`)
);
